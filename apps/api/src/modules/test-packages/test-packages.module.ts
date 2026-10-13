import { Module } from '@nestjs/common';
import { TestPackagesController } from './test-packages.controller';
import { TestPackagesService } from './test-packages.service';
import { PermissionsModule } from '../../common/permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [TestPackagesController],
  providers: [TestPackagesService],
  exports: [TestPackagesService],
})
export class TestPackagesModule {}
