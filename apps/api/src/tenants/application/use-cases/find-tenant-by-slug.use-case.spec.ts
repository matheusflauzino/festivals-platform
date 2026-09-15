import { FindTenantBySlugUseCase } from './find-tenant-by-slug.use-case';
import { InMemoryTenantsRepository } from '../../infrastructure/in-memory-tenants.repository';
import { Tenant } from '../../domain/tenant.entity';

describe('FindTenantBySlugUseCase', () => {
  it('returns the tenant when found', async () => {
    const repository = new InMemoryTenantsRepository();
    const tenant = Tenant.create({ name: 'FENAC', document: 'AB123456789012', slug: 'fenac' });
    await repository.save(tenant);

    const useCase = new FindTenantBySlugUseCase(repository);
    await expect(useCase.execute('fenac')).resolves.toEqual(tenant);
  });

  it('returns null when not found', async () => {
    const repository = new InMemoryTenantsRepository();
    const useCase = new FindTenantBySlugUseCase(repository);

    await expect(useCase.execute('missing')).resolves.toBeNull();
  });
});
