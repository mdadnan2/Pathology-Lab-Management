import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ResultsModule } from './modules/results/results.module';
import { SamplesModule } from './modules/samples/samples.module';
import { TestCatalogueModule } from './modules/test-catalogue/test-catalogue.module';
import { TestPackagesModule } from './modules/test-packages/test-packages.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    ResultsModule,
    ReportsModule,
    TestCatalogueModule,
    TestPackagesModule,
    OrdersModule,
    SamplesModule,
    AuditModule,
    BillingModule,
    DashboardModule,
  ],
})
export class AppModule {}
