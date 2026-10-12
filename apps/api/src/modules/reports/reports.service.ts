import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  OrderStatus,
  ReportStatus,
  ResultStatus,
} from '@prisma/client';
import Decimal from 'decimal.js';
// PDFKit exports a CommonJS constructor; import-equals keeps it constructable in Node and Jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const REPORT_INCLUDE = {
  approvedBy: { select: { firstName: true, lastName: true, role: true } },
  order: {
    include: {
      patient: {
        select: {
          patientCode: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
        },
      },
      items: {
        include: {
          labTest: { include: { parameters: { orderBy: { sortOrder: 'asc' as const } } } },
          result: {
            include: {
              enteredBy: { select: { firstName: true, lastName: true } },
              reviewedBy: { select: { firstName: true, lastName: true, role: true } },
              parameters: { include: { testParameter: true } },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    status?: ReportStatus;
    search?: string;
    from?: Date;
    to?: Date;
  }) {
    const search = params.search?.trim();
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            order: {
              patient: {
                OR: [
                  { patientCode: { contains: search, mode: 'insensitive' as const } },
                  { firstName: { contains: search, mode: 'insensitive' as const } },
                  { lastName: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.labReport.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: REPORT_INCLUDE,
      }),
      this.prisma.labReport.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  async findOne(id: string) {
    const report = await this.prisma.labReport.findUnique({
      where: { id },
      include: REPORT_INCLUDE,
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async findEligibleOrders(params: { page: number; limit: number }) {
    const where = {
      status: { not: OrderStatus.CANCELLED },
      report: { is: null },
      items: {
        some: {},
        every: { result: { is: { status: ResultStatus.APPROVED } } },
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.labOrder.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          patient: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.labOrder.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  async generate(orderId: string, actorId: string) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { result: { select: { status: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Cannot generate a report for a cancelled order');
    }
    if (
      order.items.length === 0 ||
      order.items.some((item) => item.result?.status !== ResultStatus.APPROVED)
    ) {
      throw new BadRequestException('Every test result must be approved before generating a report');
    }
    const existing = await this.prisma.labReport.findUnique({ where: { orderId } });
    if (existing) throw new ConflictException('A report already exists for this order');

    const report = await this.prisma.$transaction(async (tx) => {
      const generated = await tx.labReport.create({
        data: {
          orderId,
          generatedAt: new Date(),
          status: ReportStatus.PENDING_APPROVAL,
        },
        include: REPORT_INCLUDE,
      });
      const updatedOrder = await tx.labOrder.updateMany({
        where: { id: orderId, status: { not: OrderStatus.CANCELLED } },
        data: { status: OrderStatus.APPROVED },
      });
      if (updatedOrder.count !== 1) {
        throw new ConflictException('The order was cancelled before report generation');
      }
      return generated;
    });
    await this.auditService.log({
      actorId,
      action: AuditAction.REPORT_GENERATED,
      entityType: 'LabReport',
      entityId: report.id,
      metadata: { orderNumber: order.orderNumber },
    });
    return report;
  }

  async approve(id: string, actorId: string) {
    const report = await this.prisma.labReport.findUnique({
      where: { id },
      include: { order: { select: { status: true } } },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.PENDING_APPROVAL) {
      throw new ConflictException('Only reports pending approval can be approved');
    }
    if (report.order.status === OrderStatus.CANCELLED) {
      throw new ConflictException('Cannot approve a report for a cancelled order');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.labReport.updateMany({
        where: { id, status: ReportStatus.PENDING_APPROVAL },
        data: {
          status: ReportStatus.APPROVED,
          approvedById: actorId,
          approvedAt: new Date(),
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('The report changed and can no longer be approved');
      }
      const approved = await tx.labReport.findUnique({
        where: { id },
        include: REPORT_INCLUDE,
      });
      if (!approved) throw new NotFoundException('Approved report could not be loaded');
      const updatedOrder = await tx.labOrder.updateMany({
        where: { id: report.orderId, status: { not: OrderStatus.CANCELLED } },
        data: { status: OrderStatus.REPORT_READY },
      });
      if (updatedOrder.count !== 1) {
        throw new ConflictException('The order was cancelled before report approval');
      }
      return approved;
    });
    await this.auditService.log({
      actorId,
      action: AuditAction.REPORT_APPROVED,
      entityType: 'LabReport',
      entityId: id,
      metadata: { orderId: report.orderId },
    });
    return updated;
  }

  async download(id: string, actorId: string): Promise<Buffer> {
    const report = await this.findOne(id);
    if (report.status !== ReportStatus.APPROVED && report.status !== ReportStatus.DELIVERED) {
      throw new BadRequestException('Only approved reports can be downloaded');
    }
    const pdf = await this.renderPdf(report);
    if (report.status !== ReportStatus.DELIVERED) {
      const delivered = await this.prisma.labReport.updateMany({
        where: { id, status: ReportStatus.APPROVED },
        data: { status: ReportStatus.DELIVERED },
      });
      if (delivered.count === 1) {
        await this.auditService.log({
          actorId,
          action: AuditAction.REPORT_DELIVERED,
          entityType: 'LabReport',
          entityId: id,
          metadata: { orderId: report.orderId },
        });
      }
    }
    return pdf;
  }

  private async renderPdf(report: Awaited<ReturnType<ReportsService['findOne']>>) {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.once('end', () => resolve(Buffer.concat(chunks)));
      doc.once('error', reject);
    });

    const { order, approvedBy } = report;
    const patient = order.patient;
    doc.fontSize(16).font('Helvetica-Bold').text('DEMO PATHOLOGY LABORATORY', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('FICTIONAL DEMO DATA', { align: 'center' });
    doc.moveDown();
    doc.fontSize(9).text('DEMO DATA — NOT FOR CLINICAL USE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).font('Helvetica-Bold').text('Patient and order details');
    doc.font('Helvetica').fontSize(10)
      .text(`Patient: ${patient.firstName} ${patient.lastName} (${patient.patientCode})`)
      .text(`Date of birth: ${patient.dateOfBirth.toISOString().slice(0, 10)} · Gender: ${patient.gender}`)
      .text(`Order: ${order.orderNumber}`)
      .text(`Order date: ${order.createdAt.toISOString()}`)
      .text(`Report date: ${(report.approvedAt ?? report.generatedAt ?? report.createdAt).toISOString()}`);
    doc.moveDown();

    for (const item of order.items) {
      doc.font('Helvetica-Bold').fontSize(11).text(item.testNameSnapshot);
      if (!item.result) continue;
      for (const value of item.result.parameters) {
        const parameter = value.testParameter;
        const range = parameter.referenceRangeText
          ?? `${parameter.referenceRangeLow?.toString() ?? '—'} - ${parameter.referenceRangeHigh?.toString() ?? '—'}`;
        const numericValue = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.value)
          ? new Decimal(value.value)
          : null;
        const abnormalDirection = value.isAbnormal
          ? numericValue &&
            parameter.referenceRangeLow !== null &&
            numericValue.lessThan(parameter.referenceRangeLow)
            ? '↓ LOW'
            : '↑ HIGH'
          : 'Within illustrative range';
        doc.font('Helvetica').fontSize(9).text(
          `${parameter.name}: ${value.value} ${value.unit ?? ''} · Reference: ${range} · ${abnormalDirection}`,
        );
      }
      if (item.result.notes) doc.font('Helvetica-Oblique').text(`Notes: ${item.result.notes}`);
      doc.moveDown(0.5);
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(10).text('Approved by');
    doc.font('Helvetica').fontSize(9).text(
      approvedBy ? `${approvedBy.firstName} ${approvedBy.lastName} (${approvedBy.role})` : 'Authorized Pathologist',
    );
    if (report.approvedAt) doc.text(`Approved at: ${report.approvedAt.toISOString()}`);
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(9).text('THIS REPORT IS DEMO DATA AND NOT FOR CLINICAL USE', { align: 'center' });
    doc.end();
    return finished;
  }
}
