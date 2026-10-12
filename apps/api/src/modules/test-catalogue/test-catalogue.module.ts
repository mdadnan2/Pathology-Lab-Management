import { Module } from '@nestjs/common';
import { TestCatalogueController } from './test-catalogue.controller';
import { TestCatalogueService } from './test-catalogue.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TestCatalogueController],
  providers: [TestCatalogueService],
  exports: [TestCatalogueService],
})
export class TestCatalogueModule {}
