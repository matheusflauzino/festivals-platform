import { Module } from '@nestjs/common';
import { TenantsController } from './infrastructure/tenants.controller';
import { PrismaTenantsRepository } from './infrastructure/prisma-tenants.repository';
import { TENANTS_REPOSITORY } from './application/ports/tenants-repository.port';
import { CreateTenantUseCase } from './application/use-cases/create-tenant.use-case';
import { FindTenantBySlugUseCase } from './application/use-cases/find-tenant-by-slug.use-case';

@Module({
  controllers: [TenantsController],
  providers: [
    CreateTenantUseCase,
    FindTenantBySlugUseCase,
    { provide: TENANTS_REPOSITORY, useClass: PrismaTenantsRepository },
  ],
})
export class TenantsModule {}
