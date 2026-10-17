import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SamplesController } from './samples.controller';

describe('SamplesController authorization', () => {
  const controller = Object.create(SamplesController.prototype) as SamplesController;
  const guard = new RolesGuard(new Reflector());
  const contextFor = (role: Role) => ({
    getHandler: () => controller.updateStatus,
    getClass: () => SamplesController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  }) as unknown as ExecutionContext;

  it.each([Role.OWNER, Role.ADMIN, Role.TECHNICIAN])(
    'allows %s to reach sample-status service validation',
    (role) => {
      expect(guard.canActivate(contextFor(role))).toBe(true);
    },
  );

  it.each([Role.RECEPTIONIST, Role.PATHOLOGIST])(
    'rejects direct sample-status requests from %s',
    (role) => {
      expect(() => guard.canActivate(contextFor(role))).toThrow(
        new ForbiddenException('You do not have permission to perform this action'),
      );
    },
  );
});
