import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../../common/permissions/permissions.module';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
