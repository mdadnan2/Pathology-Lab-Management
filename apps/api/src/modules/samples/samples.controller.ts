import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, SampleStatus, User } from '@prisma/client';
import { SamplesService } from './samples.service';
import { UpdateSampleStatusDto } from './dto/sample.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('samples')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PasswordChangeGuard)
@Controller('samples')
export class SamplesController {
  constructor(private service: SamplesService) {}

  @Get()
  @ApiOperation({ summary: 'List samples' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('status') status?: SampleStatus,
  ) {
    return this.service.findAll({ page: parseInt(page, 10), limit: Math.min(parseInt(limit, 10), 100), status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sample detail' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id/status')
  @Roles(Role.OWNER, Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Update sample status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSampleStatusDto, @CurrentUser() actor: User) {
    return this.service.updateStatus(id, dto, actor.id);
  }
}
