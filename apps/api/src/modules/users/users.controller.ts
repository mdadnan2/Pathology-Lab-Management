import {
  BadRequestException, Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { PERMISSIONS, isPermissionKey } from '../../common/permissions/permission-policy';
import { IsString, MaxLength, MinLength } from 'class-validator';

class PermissionChangeDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

class GrantPermissionDto extends PermissionChangeDto {
  @IsString()
  permission!: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PasswordChangeGuard)
@Roles(Role.OWNER, Role.ADMIN)
@RequirePermissions(PERMISSIONS.STAFF_MANAGE)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create staff account' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: User) {
    return this.usersService.create(dto, actor.id, actor.role);
  }

  @Get()
  @ApiOperation({ summary: 'List staff accounts' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('search') search?: string,
    @Query('role') role?: Role,
  ) {
    return this.usersService.findAll({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      search,
      role,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff detail' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update staff' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: User) {
    return this.usersService.update(id, dto, actor.id, actor.role);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate staff account' })
  deactivate(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.usersService.deactivate(id, actor.id, actor.role);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Reset staff password' })
  resetPassword(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.usersService.resetPassword(id, actor.id, actor.role);
  }

  @Post(':id/permissions')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Grant explicit clinical permission to a staff account' })
  grantPermission(
    @Param('id') id: string,
    @Body() dto: GrantPermissionDto,
    @CurrentUser() actor: User,
  ) {
    if (!isPermissionKey(dto.permission)) {
      throw new BadRequestException('Unknown permission');
    }
    return this.usersService.grantPermission(id, dto.permission, actor.id, dto.reason);
  }

  @Post(':id/permissions/:permission/revoke')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Revoke explicit clinical permission from a staff account' })
  revokePermission(
    @Param('id') id: string,
    @Param('permission') permission: string,
    @Body() dto: PermissionChangeDto,
    @CurrentUser() actor: User,
  ) {
    if (!isPermissionKey(permission)) {
      throw new BadRequestException('Unknown permission');
    }
    return this.usersService.revokePermission(id, permission, actor.id, dto.reason);
  }
}
