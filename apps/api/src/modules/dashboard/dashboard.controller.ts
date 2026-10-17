import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderStatus, ReportStatus, ResultStatus, Role, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission-policy';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PasswordChangeGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.TECHNICIAN, Role.PATHOLOGIST)
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats(@CurrentUser() actor: User) {
    if (actor.role === Role.RECEPTIONIST) {
      const [totalPatients, pendingOrders, pendingSamples] = await Promise.all([
        this.prisma.patient.count({ where: { isActive: true } }),
        this.prisma.labOrder.count({ where: { status: OrderStatus.NEW } }),
        this.prisma.sample.count({ where: { status: 'PENDING' } }),
      ]);
      return { totalPatients, pendingOrders, pendingSamples };
    }

    if (actor.role === Role.TECHNICIAN) {
      const [pendingSamples, collectedSamples, processingSamples, processingOrders] = await Promise.all([
        this.prisma.sample.count({ where: { status: 'PENDING' } }),
        this.prisma.sample.count({ where: { status: 'COLLECTED' } }),
        this.prisma.sample.count({ where: { status: 'PROCESSING' } }),
        this.prisma.labOrder.count({ where: { status: OrderStatus.PROCESSING } }),
      ]);
      return { pendingSamples, collectedSamples, processingSamples, processingOrders };
    }

    if (actor.role === Role.PATHOLOGIST) {
      const [resultsAwaitingReview, reportsAwaitingApproval, completedOrders] = await Promise.all([
        this.prisma.testResult.count({
          where: { status: { in: [ResultStatus.SUBMITTED, ResultStatus.UNDER_REVIEW] } },
        }),
        this.prisma.labReport.count({ where: { status: ReportStatus.PENDING_APPROVAL } }),
        this.prisma.labOrder.count({ where: { status: OrderStatus.REPORT_READY } }),
      ]);
      return { resultsAwaitingReview, reportsAwaitingApproval, completedOrders };
    }

    const [totalPatients, pendingOrders, processingOrders, completedOrders, pendingSamples, collectedSamples, totalTests, activeCategories] = await Promise.all([
      this.prisma.patient.count({ where: { isActive: true } }),
      this.prisma.labOrder.count({ where: { status: 'NEW' } }),
      this.prisma.labOrder.count({ where: { status: 'PROCESSING' } }),
      this.prisma.labOrder.count({ where: { status: OrderStatus.REPORT_READY } }),
      this.prisma.sample.count({ where: { status: 'PENDING' } }),
      this.prisma.sample.count({ where: { status: 'COLLECTED' } }),
      this.prisma.labTest.count({ where: { isActive: true } }),
      this.prisma.testCategory.count(),
    ]);

    return {
      totalPatients,
      pendingOrders,
      processingOrders,
      completedOrders,
      pendingSamples,
      collectedSamples,
      totalTests,
      activeCategories,
    };
  }
}
