import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../../common/permissions/permissions.module';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
