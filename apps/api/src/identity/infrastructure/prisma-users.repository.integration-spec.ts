import { User } from '../domain/user.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaUsersRepository } from './prisma-users.repository';

describe('PrismaUsersRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaUsersRepository;
  const tenantId = 'integration-test-tenant-id';
  const email = 'integration-user@example.com';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repository = new PrismaUsersRepository(prisma);
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('saves a user and finds it back by email or cpf', async () => {
    const user = User.create({
      tenantId,
      name: 'Integration Test User',
      email,
      cpf: '98765432100',
      passwordHash: 'hashed-password',
    });

    await repository.save(user);

    const foundByEmail = await repository.findByEmailOrCpf(tenantId, email);
    expect(foundByEmail?.id).toBe(user.id);

    const foundByCpf = await repository.findByEmailOrCpf(tenantId, '98765432100');
    expect(foundByCpf?.id).toBe(user.id);

    const foundById = await repository.findById(user.id);
    expect(foundById?.email).toBe(email);
  });

  it('does not find a user from a different tenant', async () => {
    const user = User.create({
      tenantId,
      name: 'Integration Test User',
      email,
      cpf: '98765432100',
      passwordHash: 'hashed-password',
    });
    await repository.save(user);

    const found = await repository.findByEmailOrCpf('different-tenant', email);
    expect(found).toBeNull();
  });
});
