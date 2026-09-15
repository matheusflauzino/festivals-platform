import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseFilters,
  UsePipes,
} from '@nestjs/common';
import { createTenantSchema } from '@fenac-platform/contracts';
import type { CreateTenantDto } from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TenantConflictExceptionFilter } from '../../common/filters/tenant-conflict.filter';
import { CreateTenantUseCase } from '../application/use-cases/create-tenant.use-case';
import { FindTenantBySlugUseCase } from '../application/use-cases/find-tenant-by-slug.use-case';

@Controller('tenants')
@UseFilters(TenantConflictExceptionFilter)
export class TenantsController {
  constructor(
    private readonly createTenant: CreateTenantUseCase,
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(createTenantSchema))
  async create(@Body() body: CreateTenantDto) {
    const tenant = await this.createTenant.execute(body);
    return {
      id: tenant.id,
      name: tenant.name,
      document: tenant.document,
      slug: tenant.slug,
      status: tenant.status,
    };
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.findTenantBySlug.execute(slug);
    if (!tenant) {
      throw new NotFoundException();
    }
    return {
      id: tenant.id,
      name: tenant.name,
      document: tenant.document,
      slug: tenant.slug,
      status: tenant.status,
    };
  }
}
