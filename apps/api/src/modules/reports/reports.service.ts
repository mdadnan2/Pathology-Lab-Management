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

  async findAll(params: { page: number; limit: number; status?: ReportStatus }) {
    const where = params.status ? { status: params.status } : {};
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
      status: OrderStatus.APPROVED,
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

    const report = await this.prisma.labReport.create({
      data: {
        orderId,
        generatedAt: new Date(),
        status: ReportStatus.PENDING_APPROVAL,
      },
      include: REPORT_INCLUDE,
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
    const report = await this.prisma.labReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.PENDING_APPROVAL) {
      throw new ConflictException('Only reports pending approval can be approved');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const approved = await tx.labReport.update({
        where: { id },
        data: {
          status: ReportStatus.APPROVED,
          approvedById: actorId,
          approvedAt: new Date(),
        },
        include: REPORT_INCLUDE,
      });
      await tx.labOrder.update({
        where: { id: report.orderId },
        data: { status: OrderStatus.REPORT_READY },
      });
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
      await this.prisma.labReport.update({
        where: { id },
        data: { status: ReportStatus.DELIVERED },
      });
      await this.auditService.log({
        actorId,
        action: AuditAction.REPORT_DELIVERED,
        entityType: 'LabReport',
        entityId: id,
        metadata: { orderId: report.orderId },
      });
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
        doc.font('Helvetica').fontSize(9).text(
          `${parameter.name}: ${value.value} ${value.unit ?? ''} · Reference: ${range} · ${value.isAbnormal ? 'Outside illustrative range' : 'Within illustrative range'}`,
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
