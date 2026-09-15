import { CreateTenantUseCase } from './create-tenant.use-case';
import { InMemoryTenantsRepository } from '../../infrastructure/in-memory-tenants.repository';

describe('CreateTenantUseCase', () => {
  it('creates and persists a tenant', async () => {
    const repository = new InMemoryTenantsRepository();
    const useCase = new CreateTenantUseCase(repository);

    const tenant = await useCase.execute({
      name: 'FENAC',
      document: 'AB123456789012',
      slug: 'fenac',
    });

    expect(tenant.slug).toBe('fenac');
    await expect(repository.findBySlug('fenac')).resolves.toEqual(tenant);
  });

  it('rejects a slug that is already taken', async () => {
    const repository = new InMemoryTenantsRepository();
    const useCase = new CreateTenantUseCase(repository);

    await useCase.execute({ name: 'FENAC', document: 'AB123456789012', slug: 'fenac' });

    await expect(
      useCase.execute({ name: 'Outro', document: 'CD123456789012', slug: 'fenac' }),
    ).rejects.toThrow('slug already taken');
  });
});
