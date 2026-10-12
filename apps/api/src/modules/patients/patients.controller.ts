import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PasswordChangeGuard)
@Controller('patients')
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Register a new patient' })
  create(@Body() dto: CreatePatientDto, @CurrentUser() actor: User) {
    return this.patientsService.create(dto, actor.id);
  }

  @Get()
  @ApiOperation({ summary: 'List and search patients' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('search') search?: string,
  ) {
    return this.patientsService.findAll({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient detail' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @ApiOperation({ summary: 'Update patient details' })
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @CurrentUser() actor: User) {
    return this.patientsService.update(id, dto, actor.id);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Get patient order history' })
  getOrderHistory(@Param('id') id: string) {
    return this.patientsService.getOrderHistory(id);
  }
}
