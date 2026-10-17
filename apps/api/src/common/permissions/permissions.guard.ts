import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, User } from '@prisma/client';
import { PermissionsService } from './permissions.service';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionKey } from './permission-policy';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    if (!request.user?.id || !request.user.role) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    const permissions = await this.permissionsService.getPermissions(
      request.user.id,
      request.user.role as Role,
    );
    if (!required.every((permission) => permissions.includes(permission))) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
