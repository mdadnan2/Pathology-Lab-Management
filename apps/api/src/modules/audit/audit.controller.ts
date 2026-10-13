import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditAction, Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission-policy';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PasswordChangeGuard)
@Roles(Role.OWNER, Role.ADMIN)
@RequirePermissions(PERMISSIONS.AUDIT_VIEW)
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit log (paginated)' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '5',
    @Query('actorId') actorId?: string,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.findAll({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      actorId,
      action,
      entityType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
