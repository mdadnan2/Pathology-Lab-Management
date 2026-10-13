import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { PermissionsModule } from '../../common/permissions/permissions.module';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
