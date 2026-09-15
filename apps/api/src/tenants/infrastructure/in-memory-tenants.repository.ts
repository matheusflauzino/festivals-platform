import { Tenant } from '../domain/tenant.entity';
import { TenantsRepositoryPort } from '../application/ports/tenants-repository.port';

export class InMemoryTenantsRepository implements TenantsRepositoryPort {
  private readonly tenants = new Map<string, Tenant>();

  save(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.slug, tenant);
    return Promise.resolve();
  }

  findBySlug(slug: string): Promise<Tenant | null> {
    return Promise.resolve(this.tenants.get(slug) ?? null);
  }
}
