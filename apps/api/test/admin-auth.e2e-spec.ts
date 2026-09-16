import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AdminUser } from '../src/admin-identity/domain/admin-user.entity';
import { BcryptPasswordHasher } from '../src/identity/infrastructure/bcrypt-password-hasher';

interface LoginResponseBody {
  accessToken: string;
  admin: { id: string; name: string; email: string; role: string };
}
interface RefreshResponseBody {
  accessToken: string;
}
interface MeResponseBody {
  id: string;
  name: string;
  email: string;
  role: string;
}
interface InviteResponseBody {
  id: string;
  email: string;
  status: string;
}

describe('AdminAuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantSlug = 'admin-auth-e2e-tenant';
  let tenantId: string;
  const organizerEmail = 'organizer-e2e@example.com';
  const newAdminEmail = 'new-admin-e2e@example.com';

  const otherTenantSlug = 'admin-auth-e2e-other-tenant';
  let otherTenantId: string;
  const otherOrganizerEmail = 'other-organizer-e2e@example.com';
  const crossTenantAdminEmail = 'cross-tenant-e2e@example.com';

  async function seedActiveOrganizer(
    tenantIdForSeed: string,
    email: string,
    password: string,
  ) {
    const hasher = new BcryptPasswordHasher();
    const organizer = AdminUser.invite({
      tenantId: tenantIdForSeed,
      name: 'Seed Organizer',
      email,
      role: 'ORGANIZER',
    }).activate(await hasher.hash(password));
    await prisma.adminUser.create({
      data: {
        id: organizer.id,
        tenantId: organizer.tenantId,
        name: organizer.name,
        email: organizer.email,
        role: organizer.role,
        status: organizer.status,
        passwordHash: organizer.passwordHash,
        inviteToken: organizer.inviteToken,
      },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    const tenant = await prisma.tenant.create({
      data: {
        name: 'Admin Auth E2E Tenant',
        document: 'AA123456789012',
        slug: tenantSlug,
        status: 'ACTIVE',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        name: 'Admin Auth E2E Other Tenant',
        document: 'AA987654321098',
        slug: otherTenantSlug,
        status: 'ACTIVE',
      },
    });
    otherTenantId = otherTenant.id;

    // Seed the first ORGANIZER directly — bootstrapping the very first admin of a
    // tenant is out of scope for this plan (see Global Constraints); production
    // bootstrapping happens via the future legacy-data migration.
    await seedActiveOrganizer(tenantId, organizerEmail, 'organizer-password');
    await seedActiveOrganizer(
      otherTenantId,
      otherOrganizerEmail,
      'other-organizer-password',
    );
  });

  afterEach(async () => {
    await prisma.adminUser.deleteMany({
      where: { email: { in: [newAdminEmail, crossTenantAdminEmail] } },
    });
  });

  afterAll(async () => {
    await prisma.adminUser.deleteMany({ where: { tenantId } });
    await prisma.adminUser.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.tenant.deleteMany({ where: { id: otherTenantId } });
    await app.close();
  });

  async function organizerAccessToken(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/login`)
      .send({ email: organizerEmail, password: 'organizer-password' })
      .expect(200);
    return (response.body as LoginResponseBody).accessToken;
  }

  it('full flow: organizer invites, invitee accepts, invitee logs in, refreshes, and reads /me', async () => {
    const token = await organizerAccessToken();

    const inviteResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Admin', email: newAdminEmail, role: 'JUDGE' })
      .expect(201);

    const invited = inviteResponse.body as InviteResponseBody;
    expect(invited.status).toBe('PENDING');

    const created = await prisma.adminUser.findUniqueOrThrow({
      where: { id: invited.id },
    });
    const inviteToken = created.inviteToken as string;

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites/${inviteToken}/accept`)
      .send({ password: 'a-strong-password' })
      .expect(200);

    const loginResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/login`)
      .send({ email: newAdminEmail, password: 'a-strong-password' })
      .expect(200);

    const loginBody = loginResponse.body as LoginResponseBody;
    expect(loginBody.admin.role).toBe('JUDGE');
    const setCookieHeader = loginResponse.headers['set-cookie'];
    expect(setCookieHeader[0]).toContain('adminRefreshToken=');
    expect(setCookieHeader[0]).toContain('HttpOnly');

    const refreshResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/refresh`)
      .set('Cookie', setCookieHeader)
      .expect(200);
    expect(
      (refreshResponse.body as RefreshResponseBody).accessToken,
    ).toBeDefined();

    const meResponse = await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/admin/me`)
      .set('Authorization', `Bearer ${loginBody.accessToken}`)
      .expect(200);
    expect((meResponse.body as MeResponseBody).email).toBe(newAdminEmail);
  });

  it('rejects an invite attempt from a non-ORGANIZER role', async () => {
    const organizerToken = await organizerAccessToken();

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'New Admin', email: newAdminEmail, role: 'JUDGE' })
      .expect(201);

    const created = await prisma.adminUser.findFirstOrThrow({
      where: { email: newAdminEmail },
    });
    await request(app.getHttpServer())
      .post(
        `/tenants/${tenantSlug}/admin/invites/${created.inviteToken}/accept`,
      )
      .send({ password: 'a-strong-password' })
      .expect(200);

    const judgeLogin = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/login`)
      .send({ email: newAdminEmail, password: 'a-strong-password' })
      .expect(200);
    const judgeToken = (judgeLogin.body as LoginResponseBody).accessToken;

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites`)
      .set('Authorization', `Bearer ${judgeToken}`)
      .send({
        name: 'Someone Else',
        email: 'someone-else@example.com',
        password: 'x',
      })
      .expect(403);
  });

  it('rejects an invite request with no auth token at all', async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites`)
      .send({ name: 'New Admin', email: newAdminEmail, role: 'JUDGE' })
      .expect(401);
  });

  it('records an audit log row when an invite succeeds', async () => {
    const token = await organizerAccessToken();

    const inviteResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Admin', email: newAdminEmail, role: 'JUDGE' })
      .expect(201);

    const invited = inviteResponse.body as InviteResponseBody;
    const logs = await prisma.auditLog.findMany({
      where: { targetType: 'AdminUser', targetId: invited.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('invited_admin');
    await prisma.auditLog.deleteMany({ where: { targetId: invited.id } });
  });

  it('returns 409, not 500, when inviting an already-registered email', async () => {
    const token = await organizerAccessToken();

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Admin', email: newAdminEmail, role: 'JUDGE' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicate', email: newAdminEmail, role: 'COMMITTEE' })
      .expect(409);
  });

  it("rejects a token minted for one tenant when used against another tenant's /me", async () => {
    const token = await organizerAccessToken();

    await request(app.getHttpServer())
      .get(`/tenants/${otherTenantSlug}/admin/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a cross-tenant invite attempt and does not create an admin in the target tenant', async () => {
    const token = await organizerAccessToken();

    await request(app.getHttpServer())
      .post(`/tenants/${otherTenantSlug}/admin/invites`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cross Tenant Admin',
        email: crossTenantAdminEmail,
        role: 'JUDGE',
      })
      .expect(401);

    const created = await prisma.adminUser.findFirst({
      where: { email: crossTenantAdminEmail },
    });
    expect(created).toBeNull();
  });

  it('rejects accepting an invite via the wrong tenant URL, leaving the admin PENDING', async () => {
    const token = await organizerAccessToken();

    const inviteResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Admin', email: newAdminEmail, role: 'JUDGE' })
      .expect(201);

    const invited = inviteResponse.body as InviteResponseBody;
    const created = await prisma.adminUser.findUniqueOrThrow({
      where: { id: invited.id },
    });
    const inviteToken = created.inviteToken as string;

    await request(app.getHttpServer())
      .post(`/tenants/${otherTenantSlug}/admin/invites/${inviteToken}/accept`)
      .send({ password: 'a-strong-password' })
      .expect(404);

    const stillPending = await prisma.adminUser.findUniqueOrThrow({
      where: { id: invited.id },
    });
    expect(stillPending.status).toBe('PENDING');
    expect(stillPending.passwordHash).toBeNull();
  });
});
