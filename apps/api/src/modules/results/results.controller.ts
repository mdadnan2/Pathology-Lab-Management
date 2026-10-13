import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResultStatus, Role, User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission-policy';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PasswordChangeGuard } from '../../common/guards/password-change.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReviewResultDto, SaveResultDto } from './dto/result.dto';
import { ResultsService } from './results.service';

@ApiTags('results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PasswordChangeGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.RESULTS_VIEW)
  @Roles(Role.OWNER, Role.ADMIN, Role.TECHNICIAN, Role.PATHOLOGIST)
  @ApiOperation({ summary: 'List order results and eligible items' })
  findAll(
    @CurrentUser() actor: User,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status', new ParseEnumPipe(ResultStatus, { optional: true })) status?: ResultStatus,
  ) {
    return this.service.findAll({
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)),
      status,
      actorId: actor.id,
      isTechnician: actor.role === Role.TECHNICIAN,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.RESULTS_VIEW)
  @Roles(Role.OWNER, Role.ADMIN, Role.TECHNICIAN, Role.PATHOLOGIST)
  @ApiOperation({ summary: 'Get a result' })
  findOne(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.service.findOne(id, actor.id, actor.role === Role.TECHNICIAN);
  }

  @Post('items/:orderItemId')
  @Roles(Role.OWNER, Role.ADMIN, Role.TECHNICIAN)
  @RequirePermissions(PERMISSIONS.RESULTS_ENTER)
  @ApiOperation({ summary: 'Save result draft for an order item' })
  saveDraft(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: SaveResultDto,
    @CurrentUser() actor: User,
  ) {
    return this.service.saveDraft(orderItemId, dto, actor.id);
  }

  @Post(':id/submit')
  @Roles(Role.OWNER, Role.ADMIN, Role.TECHNICIAN)
  @RequirePermissions(PERMISSIONS.RESULTS_SUBMIT)
  @ApiOperation({ summary: 'Submit a result for review' })
  submit(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.service.submit(id, actor.id);
  }

  @Patch(':id/review')
  @RequirePermissions(PERMISSIONS.RESULTS_REVIEW)
  @ApiOperation({ summary: 'Review, approve, or reject a submitted result' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewResultDto,
    @CurrentUser() actor: User,
  ) {
    return this.service.review(id, dto, actor.id);
  }
}
