import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminIdentityModule } from '../admin-identity/admin-identity.module';
import { FestivalsController } from './infrastructure/festivals.controller';
import { PrismaFestivalsRepository } from './infrastructure/prisma-festivals.repository';
import { PrismaStagesRepository } from './infrastructure/prisma-stages.repository';
import { PrismaGradeCriteriaRepository } from './infrastructure/prisma-grade-criteria.repository';
import { FESTIVALS_REPOSITORY } from './application/ports/festivals-repository.port';
import { STAGES_REPOSITORY } from './application/ports/stages-repository.port';
import { GRADE_CRITERIA_REPOSITORY } from './application/ports/grade-criteria-repository.port';
import { CreateFestivalUseCase } from './application/use-cases/create-festival.use-case';
import { ListFestivalsUseCase } from './application/use-cases/list-festivals.use-case';
import { GetFestivalUseCase } from './application/use-cases/get-festival.use-case';
import { UpdateFestivalDetailsUseCase } from './application/use-cases/update-festival-details.use-case';
import { PublishFestivalUseCase } from './application/use-cases/publish-festival.use-case';
import { CloseFestivalUseCase } from './application/use-cases/close-festival.use-case';
import { CreateStageUseCase } from './application/use-cases/create-stage.use-case';
import { ListStagesUseCase } from './application/use-cases/list-stages.use-case';
import { CreateGradeCriterionUseCase } from './application/use-cases/create-grade-criterion.use-case';
import { ListGradeCriteriaUseCase } from './application/use-cases/list-grade-criteria.use-case';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';

@Module({
  imports: [TenantsModule, AdminIdentityModule],
  controllers: [FestivalsController],
  providers: [
    CreateFestivalUseCase,
    ListFestivalsUseCase,
    GetFestivalUseCase,
    UpdateFestivalDetailsUseCase,
    PublishFestivalUseCase,
    CloseFestivalUseCase,
    CreateStageUseCase,
    ListStagesUseCase,
    CreateGradeCriterionUseCase,
    ListGradeCriteriaUseCase,
    RolesGuard,
    AuditLogInterceptor,
    { provide: FESTIVALS_REPOSITORY, useClass: PrismaFestivalsRepository },
    { provide: STAGES_REPOSITORY, useClass: PrismaStagesRepository },
    {
      provide: GRADE_CRITERIA_REPOSITORY,
      useClass: PrismaGradeCriteriaRepository,
    },
  ],
})
export class FestivalsModule {}
