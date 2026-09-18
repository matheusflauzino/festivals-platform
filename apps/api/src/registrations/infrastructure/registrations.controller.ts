import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { createRegistrationSchema } from '@fenac-platform/contracts';
import type { CreateRegistrationDto } from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { InvalidFestivalStateExceptionFilter } from '../../common/filters/invalid-festival-state.filter';
import { RegistrationValidationExceptionFilter } from '../../common/filters/registration-validation.filter';
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import type { Tenant } from '../../tenants/domain/tenant.entity';
import { AdminAuthGuard } from '../../admin-identity/infrastructure/admin-auth.guard';
import type { RequestWithAdmin } from '../../admin-identity/infrastructure/admin-auth.guard';
import { FESTIVALS_REPOSITORY } from '../../festivals/application/ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../../festivals/application/ports/festivals-repository.port';
import type { Festival } from '../../festivals/domain/festival.entity';
import { CreateRegistrationUseCase } from '../application/use-cases/create-registration.use-case';
import { ListRegistrationsUseCase } from '../application/use-cases/list-registrations.use-case';
import { ListFestivalRegistrationsUseCase } from '../application/use-cases/list-festival-registrations.use-case';
import type { Registration } from '../domain/registration.entity';

@Controller('tenants/:tenantSlug')
@UseGuards(AdminAuthGuard)
@UseFilters(
  InvalidFestivalStateExceptionFilter,
  RegistrationValidationExceptionFilter,
)
export class RegistrationsController {
  constructor(
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly createRegistration: CreateRegistrationUseCase,
    private readonly listRegistrations: ListRegistrationsUseCase,
    private readonly listFestivalRegistrations: ListFestivalRegistrationsUseCase,
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  private async resolveTenantForAdmin(
    tenantSlug: string,
    request: RequestWithAdmin,
  ): Promise<Tenant> {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');
    if (tenant.id !== request.admin!.tenantId) {
      throw new UnauthorizedException();
    }
    return tenant;
  }

  private toRegistrationDto(
    registration: Registration,
    festival: Festival | null,
  ) {
    return {
      id: registration.id,
      festivalId: registration.festivalId,
      festivalNumber: festival?.number ?? null,
      festivalYear: festival?.year ?? null,
      festivalName: festival?.name ?? null,
      participantName: registration.participantName,
      participantEmail: registration.participantEmail,
      participantCpf: registration.participantCpf,
      songName: registration.songName,
      performers: registration.performers,
      musicComposer: registration.musicComposer,
      lyricsComposer: registration.lyricsComposer,
      videoUrl: registration.videoUrl,
      createdAt: registration.createdAt,
    };
  }

  @Post('festivals/:festivalId/registrations')
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('created_registration', (result: unknown) => ({
    targetType: 'Registration',
    targetId: (result as { id: string }).id,
  }))
  async create(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(createRegistrationSchema))
    body: CreateRegistrationDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const registration = await this.createRegistration.execute({
      tenantId: tenant.id,
      festivalId,
      ...body,
    });
    if (!registration) throw new NotFoundException('festival not found');
    const festival = await this.festivalsRepository.findById(
      tenant.id,
      festivalId,
    );
    return this.toRegistrationDto(registration, festival);
  }

  @Get('festivals/:festivalId/registrations')
  async listByFestival(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const registrations = await this.listFestivalRegistrations.execute(
      tenant.id,
      festivalId,
    );
    if (!registrations) throw new NotFoundException('festival not found');
    const festival = await this.festivalsRepository.findById(
      tenant.id,
      festivalId,
    );
    return registrations.map((registration) =>
      this.toRegistrationDto(registration, festival),
    );
  }

  @Get('registrations')
  async listAll(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const registrations = await this.listRegistrations.execute(tenant.id);
    const festivals = await this.festivalsRepository.findAllByTenant(tenant.id);
    const festivalById = new Map(
      festivals.map((festival) => [festival.id, festival]),
    );
    return registrations.map((registration) =>
      this.toRegistrationDto(
        registration,
        festivalById.get(registration.festivalId) ?? null,
      ),
    );
  }
}
