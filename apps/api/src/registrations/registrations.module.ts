import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminIdentityModule } from '../admin-identity/admin-identity.module';
import { FestivalsModule } from '../festivals/festivals.module';
import { RegistrationsController } from './infrastructure/registrations.controller';
import { PrismaRegistrationsRepository } from './infrastructure/prisma-registrations.repository';
import { REGISTRATIONS_REPOSITORY } from './application/ports/registrations-repository.port';
import { CreateRegistrationUseCase } from './application/use-cases/create-registration.use-case';
import { ListRegistrationsUseCase } from './application/use-cases/list-registrations.use-case';
import { ListFestivalRegistrationsUseCase } from './application/use-cases/list-festival-registrations.use-case';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';

@Module({
  imports: [TenantsModule, AdminIdentityModule, FestivalsModule],
  controllers: [RegistrationsController],
  providers: [
    CreateRegistrationUseCase,
    ListRegistrationsUseCase,
    ListFestivalRegistrationsUseCase,
    RolesGuard,
    AuditLogInterceptor,
    {
      provide: REGISTRATIONS_REPOSITORY,
      useClass: PrismaRegistrationsRepository,
    },
  ],
})
export class RegistrationsModule {}
