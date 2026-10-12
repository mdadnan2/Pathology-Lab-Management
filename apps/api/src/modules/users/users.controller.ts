import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
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

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PasswordChangeGuard)
@Roles(Role.OWNER, Role.ADMIN)
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
}
