import { Tenant } from '../../domain/tenant.entity';

export interface TenantsRepositoryPort {
  save(tenant: Tenant): Promise<void>;
  findBySlug(slug: string): Promise<Tenant | null>;
}

export const TENANTS_REPOSITORY = Symbol('TENANTS_REPOSITORY');
