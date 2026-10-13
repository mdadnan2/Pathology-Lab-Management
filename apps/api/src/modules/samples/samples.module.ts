import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../../common/permissions/permissions.module';
import { SamplesController } from './samples.controller';
import { SamplesService } from './samples.service';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [SamplesController],
  providers: [SamplesService],
  exports: [SamplesService],
})
export class SamplesModule {}
