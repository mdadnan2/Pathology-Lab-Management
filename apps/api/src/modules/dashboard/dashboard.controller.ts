import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface DashboardStats {
  totalPatients: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  pendingSamples: number;
  collectedSamples: number;
  totalTests: number;
  activeCategories: number;
}

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PasswordChangeGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.TECHNICIAN, Role.PATHOLOGIST)
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats() {
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
