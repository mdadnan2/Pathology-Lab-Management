import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [AuditModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
