import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { TestCatalogueService } from './test-catalogue.service';
import {
  CreateLabTestDto, UpdateLabTestDto,
  CreateTestCategoryDto, CreateTestParameterDto,
} from './dto/test-catalogue.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission-policy';

@ApiTags('test-catalogue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PasswordChangeGuard)
@Controller('test-catalogue')
export class TestCatalogueController {
  constructor(private service: TestCatalogueService) {}

  @Get('categories')
  @RequirePermissions(PERMISSIONS.CATALOGUE_VIEW)
  @ApiOperation({ summary: 'List all test categories' })
  findAllCategories() { return this.service.findAllCategories(); }

  @Post('categories')
  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermissions(PERMISSIONS.CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Create test category' })
  createCategory(@Body() dto: CreateTestCategoryDto, @CurrentUser() actor: User) {
    return this.service.createCategory(dto, actor.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOGUE_VIEW)
  @ApiOperation({ summary: 'List tests' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findAll({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      search, categoryId,
      activeOnly: activeOnly !== 'false',
    });
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermissions(PERMISSIONS.CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Create a lab test' })
  create(@Body() dto: CreateLabTestDto, @CurrentUser() actor: User) {
    return this.service.create(dto, actor.id);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOGUE_VIEW)
  @ApiOperation({ summary: 'Get test detail' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermissions(PERMISSIONS.CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Update a lab test' })
  update(@Param('id') id: string, @Body() dto: UpdateLabTestDto, @CurrentUser() actor: User) {
    return this.service.update(id, dto, actor.id);
  }

  @Patch(':id/toggle')
  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermissions(PERMISSIONS.CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Toggle test active/inactive' })
  toggle(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.service.toggleActive(id, actor.id);
  }

  @Post('parameters')
  @Roles(Role.OWNER, Role.ADMIN)
  @RequirePermissions(PERMISSIONS.CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Add parameter to a test' })
  addParameter(@Body() dto: CreateTestParameterDto) {
    return this.service.addParameter(dto);
  }
}
