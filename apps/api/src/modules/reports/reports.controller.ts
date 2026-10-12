import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  Res,
  ParseEnumPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportStatus, Role, User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';

const REPORT_READ_ROLES = [
  Role.OWNER,
  Role.ADMIN,
  Role.RECEPTIONIST,
  Role.PATHOLOGIST,
];

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PasswordChangeGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get()
  @Roles(...REPORT_READ_ROLES)
  @ApiOperation({ summary: 'List reports' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status', new ParseEnumPipe(ReportStatus, { optional: true })) status?: ReportStatus,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const parseDate = (value: string | undefined, endOfDay: boolean): Date | undefined => {
      if (!value) return undefined;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
        : new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException('Report date filters must be valid ISO dates');
      }
      return date;
    };
    return this.service.findAll({
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)),
      status,
      search,
      from: parseDate(from, false),
      to: parseDate(to, true),
    });
  }

  @Get('eligible-orders')
  @Roles(Role.OWNER, Role.ADMIN, Role.PATHOLOGIST)
  @ApiOperation({ summary: 'List approved orders without a report' })
  findEligibleOrders(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.service.findEligibleOrders({
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)),
    });
  }

  @Get(':id')
  @Roles(...REPORT_READ_ROLES)
  @ApiOperation({ summary: 'Get report details' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('orders/:orderId/generate')
  @Roles(Role.OWNER, Role.ADMIN, Role.PATHOLOGIST)
  @ApiOperation({ summary: 'Generate a report for an approved order' })
  generate(@Param('orderId') orderId: string, @CurrentUser() actor: User) {
    return this.service.generate(orderId, actor.id);
  }

  @Patch(':id/approve')
  @Roles(Role.OWNER, Role.ADMIN, Role.PATHOLOGIST)
  @ApiOperation({ summary: 'Approve a generated report' })
  approve(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.service.approve(id, actor.id);
  }

  @Post(':id/download')
  @Roles(...REPORT_READ_ROLES)
  @ApiOperation({ summary: 'Deliver and download an approved report PDF' })
  async download(
    @Param('id') id: string,
    @CurrentUser() actor: User,
    @Res() response: Response,
  ) {
    const pdf = await this.service.download(id, actor.id);
    response
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', 'attachment; filename="demo-report.pdf"')
      .send(pdf);
  }
}
