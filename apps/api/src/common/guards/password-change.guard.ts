import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { mustChangePassword: boolean };
}

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    if (request.user.mustChangePassword) {
      throw new ForbiddenException('Change your password before continuing');
    }
    return true;
  }
}
