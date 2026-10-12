import { Module } from '@nestjs/common';
import { TestPackagesController } from './test-packages.controller';
import { TestPackagesService } from './test-packages.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TestPackagesController],
  providers: [TestPackagesService],
  exports: [TestPackagesService],
})
export class TestPackagesModule {}
