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
}
interface FestivalResponseBody {
  id: string;
  status: string;
}

describe('FestivalsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantSlug = 'festivals-e2e-tenant';
  const otherTenantSlug = 'festivals-e2e-other-tenant';
  let tenantId: string;
  let otherTenantId: string;
  const organizerEmail = 'organizer-festivals-e2e@example.com';
  const otherOrganizerEmail = 'organizer-other-festivals-e2e@example.com';

  async function seedActiveOrganizer(
    forTenantId: string,
    email: string,
  ): Promise<void> {
    const hasher = new BcryptPasswordHasher();
    const organizer = AdminUser.invite({
      tenantId: forTenantId,
      name: 'Seed Organizer',
      email,
      role: 'ORGANIZER',
    }).activate(await hasher.hash('organizer-password'));
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

  async function loginAs(slug: string, email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/tenants/${slug}/admin/login`)
      .send({ email, password: 'organizer-password' })
      .expect(200);
    return (response.body as LoginResponseBody).accessToken;
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
        name: 'Festivals E2E Tenant',
        document: 'FF123456789012',
        slug: tenantSlug,
        status: 'ACTIVE',
      },
    });
    tenantId = tenant.id;
    await seedActiveOrganizer(tenantId, organizerEmail);

    const otherTenant = await prisma.tenant.create({
      data: {
        name: 'Festivals E2E Other Tenant',
        document: 'GG123456789012',
        slug: otherTenantSlug,
        status: 'ACTIVE',
      },
    });
    otherTenantId = otherTenant.id;
    await seedActiveOrganizer(otherTenantId, otherOrganizerEmail);
  });

  afterAll(async () => {
    await prisma.gradeCriterion.deleteMany({ where: { tenantId } });
    await prisma.stage.deleteMany({ where: { tenantId } });
    await prisma.festival.deleteMany({ where: { tenantId } });
    await prisma.adminUser.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });
    await app.close();
  });

  it('full flow: create, get, list, update, publish, close a festival, and add a stage with a grade criterion', async () => {
    const token = await loginAs(tenantSlug, organizerEmail);

    const createResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        number: 58,
        year: 2026,
        name: 'FENAC 2026',
        registrationBegin: '2026-01-01T08:00:00.000Z',
        registrationEnd: '2026-03-01T18:00:00.000Z',
        inscriptionFee: 25,
        allowedStates: ['MG'],
      })
      .expect(201);
    const festival = createResponse.body as FestivalResponseBody;
    expect(festival.status).toBe('DRAFT');

    await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/festivals/${festival.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listResponse.body as FestivalResponseBody[]).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/tenants/${tenantSlug}/festivals/${festival.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'FENAC 2026 — Revisado',
        registrationBegin: '2026-01-01T08:00:00.000Z',
        registrationEnd: '2026-03-01T18:00:00.000Z',
        inscriptionFee: 30,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const stageResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/stages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Classificatória', order: 1, advancementQuota: 20 })
      .expect(201);
    const stage = stageResponse.body as { id: string };

    await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/festivals/${festival.id}/stages`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(
        `/tenants/${tenantSlug}/festivals/stages/${stage.id}/grade-criteria`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Afinação', weight: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/festivals/stages/${stage.id}/grade-criteria`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects creating a festival with no auth token', async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals`)
      .send({
        number: 59,
        year: 2027,
        name: 'FENAC 2027',
        registrationBegin: '2027-01-01T08:00:00.000Z',
        registrationEnd: '2027-03-01T18:00:00.000Z',
        inscriptionFee: 25,
      })
      .expect(401);
  });

  it('rejects closing a festival that was never published (invalid state transition)', async () => {
    const token = await loginAs(tenantSlug, organizerEmail);
    const createResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        number: 60,
        year: 2028,
        name: 'FENAC 2028',
        registrationBegin: '2028-01-01T08:00:00.000Z',
        registrationEnd: '2028-03-01T18:00:00.000Z',
        inscriptionFee: 25,
      })
      .expect(201);
    const festival = createResponse.body as FestivalResponseBody;

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('returns 409, not 500, when creating a festival with a duplicate number/year', async () => {
    const token = await loginAs(tenantSlug, organizerEmail);
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        number: 61,
        year: 2029,
        name: 'FENAC 2029',
        registrationBegin: '2029-01-01T08:00:00.000Z',
        registrationEnd: '2029-03-01T18:00:00.000Z',
        inscriptionFee: 25,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        number: 61,
        year: 2029,
        name: 'FENAC 2029 (duplicado)',
        registrationBegin: '2029-01-01T08:00:00.000Z',
        registrationEnd: '2029-03-01T18:00:00.000Z',
        inscriptionFee: 25,
      })
      .expect(409);
  });

  it("rejects a token minted for one tenant when used to list another tenant's festivals", async () => {
    const otherToken = await loginAs(otherTenantSlug, otherOrganizerEmail);

    await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(401);
  });
});
