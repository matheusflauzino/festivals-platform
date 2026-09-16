import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  createFestivalSchema,
  updateFestivalSchema,
  createStageSchema,
  createGradeCriterionSchema,
} from '@fenac-platform/contracts';
import type {
  CreateFestivalDto,
  UpdateFestivalDto,
  CreateStageDto,
  CreateGradeCriterionDto,
} from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { FestivalConflictExceptionFilter } from '../../common/filters/festival-conflict.filter';
import { InvalidFestivalStateExceptionFilter } from '../../common/filters/invalid-festival-state.filter';
import { FestivalValidationExceptionFilter } from '../../common/filters/festival-validation.filter';
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import type { Tenant } from '../../tenants/domain/tenant.entity';
import { AdminAuthGuard } from '../../admin-identity/infrastructure/admin-auth.guard';
import type { RequestWithAdmin } from '../../admin-identity/infrastructure/admin-auth.guard';
import { CreateFestivalUseCase } from '../application/use-cases/create-festival.use-case';
import { ListFestivalsUseCase } from '../application/use-cases/list-festivals.use-case';
import { GetFestivalUseCase } from '../application/use-cases/get-festival.use-case';
import { UpdateFestivalDetailsUseCase } from '../application/use-cases/update-festival-details.use-case';
import { PublishFestivalUseCase } from '../application/use-cases/publish-festival.use-case';
import { CloseFestivalUseCase } from '../application/use-cases/close-festival.use-case';
import { CreateStageUseCase } from '../application/use-cases/create-stage.use-case';
import { ListStagesUseCase } from '../application/use-cases/list-stages.use-case';
import { CreateGradeCriterionUseCase } from '../application/use-cases/create-grade-criterion.use-case';
import { ListGradeCriteriaUseCase } from '../application/use-cases/list-grade-criteria.use-case';
import type { Festival } from '../domain/festival.entity';
import type { Stage } from '../domain/stage.entity';
import type { GradeCriterion } from '../domain/grade-criterion.entity';

@Controller('tenants/:tenantSlug/festivals')
@UseGuards(AdminAuthGuard)
@UseFilters(
  FestivalConflictExceptionFilter,
  InvalidFestivalStateExceptionFilter,
  FestivalValidationExceptionFilter,
)
export class FestivalsController {
  constructor(
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly createFestival: CreateFestivalUseCase,
    private readonly listFestivals: ListFestivalsUseCase,
    private readonly getFestival: GetFestivalUseCase,
    private readonly updateFestivalDetails: UpdateFestivalDetailsUseCase,
    private readonly publishFestival: PublishFestivalUseCase,
    private readonly closeFestival: CloseFestivalUseCase,
    private readonly createStage: CreateStageUseCase,
    private readonly listStages: ListStagesUseCase,
    private readonly createGradeCriterion: CreateGradeCriterionUseCase,
    private readonly listGradeCriteria: ListGradeCriteriaUseCase,
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

  private toFestivalDto(festival: Festival) {
    return {
      id: festival.id,
      number: festival.number,
      year: festival.year,
      name: festival.name,
      registrationBegin: festival.registrationBegin,
      registrationEnd: festival.registrationEnd,
      votingBegin: festival.votingBegin,
      votingEnd: festival.votingEnd,
      status: festival.status,
      inscriptionFee: festival.inscriptionFee,
      regulationUrl: festival.regulationUrl,
      allowedStates: festival.allowedStates,
    };
  }

  private toStageDto(stage: Stage) {
    return {
      id: stage.id,
      festivalId: stage.festivalId,
      name: stage.name,
      order: stage.order,
      advancementQuota: stage.advancementQuota,
    };
  }

  private toGradeCriterionDto(criterion: GradeCriterion) {
    return {
      id: criterion.id,
      stageId: criterion.stageId,
      name: criterion.name,
      weight: criterion.weight,
    };
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('created_festival', (result: unknown) => ({
    targetType: 'Festival',
    targetId: (result as { id: string }).id,
  }))
  async create(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(createFestivalSchema))
    body: CreateFestivalDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.createFestival.execute({
      tenantId: tenant.id,
      ...body,
    });
    return this.toFestivalDto(festival);
  }

  @Get()
  async list(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festivals = await this.listFestivals.execute(tenant.id);
    return festivals.map((festival) => this.toFestivalDto(festival));
  }

  @Get(':festivalId')
  async get(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.getFestival.execute(tenant.id, festivalId);
    if (!festival) throw new NotFoundException('festival not found');
    return this.toFestivalDto(festival);
  }

  @Patch(':festivalId')
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('updated_festival', (result: unknown) => ({
    targetType: 'Festival',
    targetId: (result as { id: string }).id,
  }))
  async update(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(updateFestivalSchema))
    body: UpdateFestivalDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.updateFestivalDetails.execute({
      tenantId: tenant.id,
      festivalId,
      ...body,
    });
    if (!festival) throw new NotFoundException('festival not found');
    return this.toFestivalDto(festival);
  }

  @Post(':festivalId/publish')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('published_festival', (result: unknown) => ({
    targetType: 'Festival',
    targetId: (result as { id: string }).id,
  }))
  async publish(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.publishFestival.execute(tenant.id, festivalId);
    if (!festival) throw new NotFoundException('festival not found');
    return this.toFestivalDto(festival);
  }

  @Post(':festivalId/close')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('closed_festival', (result: unknown) => ({
    targetType: 'Festival',
    targetId: (result as { id: string }).id,
  }))
  async close(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.closeFestival.execute(tenant.id, festivalId);
    if (!festival) throw new NotFoundException('festival not found');
    return this.toFestivalDto(festival);
  }

  @Post(':festivalId/stages')
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('created_stage', (result: unknown) => ({
    targetType: 'Stage',
    targetId: (result as { id: string }).id,
  }))
  async createFestivalStage(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(createStageSchema)) body: CreateStageDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const stage = await this.createStage.execute({
      tenantId: tenant.id,
      festivalId,
      ...body,
    });
    if (!stage) throw new NotFoundException('festival not found');
    return this.toStageDto(stage);
  }

  @Get(':festivalId/stages')
  async listFestivalStages(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const stages = await this.listStages.execute(tenant.id, festivalId);
    if (!stages) throw new NotFoundException('festival not found');
    return stages.map((stage) => this.toStageDto(stage));
  }

  @Post('stages/:stageId/grade-criteria')
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('created_grade_criterion', (result: unknown) => ({
    targetType: 'GradeCriterion',
    targetId: (result as { id: string }).id,
  }))
  async createStageGradeCriterion(
    @Param('tenantSlug') tenantSlug: string,
    @Param('stageId') stageId: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(createGradeCriterionSchema))
    body: CreateGradeCriterionDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const criterion = await this.createGradeCriterion.execute({
      tenantId: tenant.id,
      stageId,
      ...body,
    });
    if (!criterion) throw new NotFoundException('stage not found');
    return this.toGradeCriterionDto(criterion);
  }

  @Get('stages/:stageId/grade-criteria')
  async listStageGradeCriteria(
    @Param('tenantSlug') tenantSlug: string,
    @Param('stageId') stageId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const criteria = await this.listGradeCriteria.execute(tenant.id, stageId);
    if (!criteria) throw new NotFoundException('stage not found');
    return criteria.map((criterion) => this.toGradeCriterionDto(criterion));
  }
}
