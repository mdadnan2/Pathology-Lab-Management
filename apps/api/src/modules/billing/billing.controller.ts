import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoiceStatus, Role, User } from '@prisma/client';
import { BillingService } from './billing.service';
import { RecordPaymentDto, ApplyDiscountDto, CancelInvoiceDto } from './dto/billing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PasswordChangeGuard)
@Controller('invoices')
export class BillingController {
  constructor(private service: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('status') status?: InvoiceStatus,
    @Query('patientId') patientId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll({
      page: parseInt(page, 10), limit: Math.min(parseInt(limit, 10), 100),
      status, patientId, search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('outstanding')
  @ApiOperation({ summary: 'Outstanding dues' })
  outstanding(@Query('page') page = '1', @Query('limit') limit = '5') {
    return this.service.getOutstandingDues({
      page: parseInt(page, 10), limit: Math.min(parseInt(limit, 10), 100),
    });
  }

  @Get('collections')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Daily collections report' })
  collections(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const toDate = to ? new Date(to) : new Date();
    return this.service.getDailyCollections(fromDate, toDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice detail' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a payment' })
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto, @CurrentUser() actor: User) {
    return this.service.recordPayment(id, dto, actor.id);
  }

  @Post(':id/discount')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Apply a discount' })
  applyDiscount(@Param('id') id: string, @Body() dto: ApplyDiscountDto, @CurrentUser() actor: User) {
    return this.service.applyDiscount(id, dto, actor.id, actor.role);
  }

  @Patch(':id/cancel')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Cancel an invoice' })
  cancel(@Param('id') id: string, @Body() dto: CancelInvoiceDto, @CurrentUser() actor: User) {
    return this.service.cancelInvoice(id, dto, actor.id, actor.role);
  }

  @Patch(':id/payments/:paymentId/reverse')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Reverse a payment' })
  reversePayment(@Param('id') id: string, @Param('paymentId') paymentId: string, @CurrentUser() actor: User) {
    return this.service.reversePayment(id, paymentId, actor.id, actor.role);
  }
}
