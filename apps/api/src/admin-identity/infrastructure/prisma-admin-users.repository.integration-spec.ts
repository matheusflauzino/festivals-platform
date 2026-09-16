import { AdminUser } from '../domain/admin-user.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAdminUsersRepository } from './prisma-admin-users.repository';

describe('PrismaAdminUsersRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: PrismaAdminUsersRepository;
  let tenantId: string;
  const email = 'integration-admin@example.com';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    repository = new PrismaAdminUsersRepository(prisma);

    const tenant = await prisma.tenant.create({
      data: {
        name: 'Admin Repo Integration Tenant',
        document: 'AR123456789012',
        slug: 'admin-repo-integration-tenant',
        status: 'ACTIVE',
      },
    });
    tenantId = tenant.id;
  });

  afterEach(async () => {
    await prisma.adminUser.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.onModuleDestroy();
  });

  it('saves an admin and finds it back by email, invite token, and id', async () => {
    const admin = AdminUser.invite({
      tenantId,
      name: 'Integration Admin',
      email,
      role: 'ORGANIZER',
    });

    await repository.save(admin);

    const byEmail = await repository.findByEmail(tenantId, email);
    expect(byEmail?.id).toBe(admin.id);

    const byToken = await repository.findByInviteToken(
      admin.inviteToken as string,
    );
    expect(byToken?.id).toBe(admin.id);

    const byId = await repository.findById(tenantId, admin.id);
    expect(byId?.email).toBe(email);
  });

  it('does not find an admin from a different tenant', async () => {
    const admin = AdminUser.invite({
      tenantId,
      name: 'Integration Admin',
      email,
      role: 'ORGANIZER',
    });
    await repository.save(admin);

    const found = await repository.findByEmail('different-tenant-id', email);
    expect(found).toBeNull();
  });

  it('persists activation (status, passwordHash, cleared inviteToken)', async () => {
    const admin = AdminUser.invite({
      tenantId,
      name: 'Integration Admin',
      email,
      role: 'ORGANIZER',
    });
    await repository.save(admin);

    const activated = admin.activate('hashed-password');
    await repository.save(activated);

    const found = await repository.findByEmail(tenantId, email);
    expect(found?.status).toBe('ACTIVE');
    expect(found?.passwordHash).toBe('hashed-password');
    expect(found?.inviteToken).toBeNull();
  });
});
