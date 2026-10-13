import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { PermissionsModule } from '../../common/permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
