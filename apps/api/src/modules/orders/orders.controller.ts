import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrderStatus, Role, SampleStatus, User } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CancelOrderDto } from './dto/order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PasswordChangeGuard)
@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Create a new order' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() actor: User) {
    return this.service.create(dto, actor.id);
  }

  @Get()
  @ApiOperation({ summary: 'List orders' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('search') search?: string,
    @Query('status') status?: OrderStatus,
    @Query('patientId') patientId?: string,
    @Query('sampleStatus') sampleStatus?: SampleStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll({
      page: parseInt(page, 10), limit: Math.min(parseInt(limit, 10), 100),
      search, status, patientId,
      sampleStatus,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id/cancel')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Cancel an order' })
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @CurrentUser() actor: User) {
    return this.service.cancel(id, dto, actor.id);
  }
}
