import { Tenant } from '../domain/tenant.entity';
import { TenantsRepositoryPort } from '../application/ports/tenants-repository.port';

export class InMemoryTenantsRepository implements TenantsRepositoryPort {
  private readonly tenants = new Map<string, Tenant>();

  async save(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.slug, tenant);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenants.get(slug) ?? null;
  }
}
