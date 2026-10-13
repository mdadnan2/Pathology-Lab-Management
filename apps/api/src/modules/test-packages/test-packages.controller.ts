import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { TestPackagesService } from './test-packages.service';
import { CreateTestPackageDto, UpdateTestPackageDto } from './dto/test-package.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission-policy';

@ApiTags('test-packages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PasswordChangeGuard)
@Controller('test-packages')
export class TestPackagesController {
  constructor(private service: TestPackagesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOGUE_VIEW)
  @ApiOperation({ summary: 'List test packages' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ page: parseInt(page, 10), limit: Math.min(parseInt(limit, 10), 100), search });
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermissions(PERMISSIONS.CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Create test package' })
  create(@Body() dto: CreateTestPackageDto, @CurrentUser() actor: User) {
    return this.service.create(dto, actor.id);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOGUE_VIEW)
  @ApiOperation({ summary: 'Get package detail' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermissions(PERMISSIONS.CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Update test package' })
  update(@Param('id') id: string, @Body() dto: UpdateTestPackageDto, @CurrentUser() actor: User) {
    return this.service.update(id, dto, actor.id);
  }
}
