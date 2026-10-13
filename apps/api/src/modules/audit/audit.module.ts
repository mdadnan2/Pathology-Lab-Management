import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PermissionsModule } from '../../common/permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
