import { Inject, Injectable } from '@nestjs/common';
import { Tenant, CreateTenantInput } from '../../domain/tenant.entity';
import { TENANTS_REPOSITORY } from '../ports/tenants-repository.port';
import type { TenantsRepositoryPort } from '../ports/tenants-repository.port';

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly tenantsRepository: TenantsRepositoryPort,
  ) {}

  async execute(input: CreateTenantInput): Promise<Tenant> {
    const existing = await this.tenantsRepository.findBySlug(input.slug);
    if (existing) {
      throw new Error('slug already taken');
    }

    const tenant = Tenant.create(input);
    await this.tenantsRepository.save(tenant);
    return tenant;
  }
}
