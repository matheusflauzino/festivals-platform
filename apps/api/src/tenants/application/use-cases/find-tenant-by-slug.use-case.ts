import { Inject, Injectable } from '@nestjs/common';
import { Tenant } from '../../domain/tenant.entity';
import { TENANTS_REPOSITORY } from '../ports/tenants-repository.port';
import type { TenantsRepositoryPort } from '../ports/tenants-repository.port';

@Injectable()
export class FindTenantBySlugUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly tenantsRepository: TenantsRepositoryPort,
  ) {}

  async execute(slug: string): Promise<Tenant | null> {
    return this.tenantsRepository.findBySlug(slug);
  }
}
