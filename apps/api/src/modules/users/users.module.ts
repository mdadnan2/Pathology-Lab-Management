import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../../common/permissions/permissions.module';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
