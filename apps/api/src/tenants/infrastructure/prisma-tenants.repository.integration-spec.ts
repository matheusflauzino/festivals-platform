import { Tenant } from '../domain/tenant.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTenantsRepository } from './prisma-tenants.repository';

describe('PrismaTenantsRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaTenantsRepository;
  const testSlug = 'integration-test-tenant';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repository = new PrismaTenantsRepository(prisma);
  });

  afterEach(async () => {
    await prisma.tenant.deleteMany({ where: { slug: testSlug } });
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('saves a tenant and finds it back by slug', async () => {
    const tenant = Tenant.create({
      name: 'Integration Test Tenant',
      document: 'AB123456789012',
      slug: testSlug,
    });

    await repository.save(tenant);
    const found = await repository.findBySlug(testSlug);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(tenant.id);
    expect(found?.document).toBe('AB123456789012');
  });

  it('returns null when no tenant matches the slug', async () => {
    const found = await repository.findBySlug('does-not-exist');
    expect(found).toBeNull();
  });
});
