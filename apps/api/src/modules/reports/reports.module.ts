import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PermissionsModule } from '../../common/permissions/permissions.module';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
