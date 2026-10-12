import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordChangeGuard } from './password-change.guard';

describe('PasswordChangeGuard', () => {
  const guard = new PasswordChangeGuard();

  function contextFor(user?: { mustChangePassword: boolean }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows a user whose password does not need changing', () => {
    expect(guard.canActivate(contextFor({ mustChangePassword: false }))).toBe(
      true,
    );
  });

  it('blocks access while a password change is required', () => {
    expect(() =>
      guard.canActivate(contextFor({ mustChangePassword: true })),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests without an authenticated user', () => {
    expect(() => guard.canActivate(contextFor())).toThrow(
      UnauthorizedException,
    );
  });
});
