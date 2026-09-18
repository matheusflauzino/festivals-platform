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
}
interface RegistrationResponseBody {
  id: string;
  festivalId: string;
  festivalNumber: number | null;
  participantName: string;
  songName: string;
}

describe('RegistrationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantSlug = 'registrations-e2e-tenant';
  let tenantId: string;
  const organizerEmail = 'organizer-registrations-e2e@example.com';

  async function seedActiveOrganizer(): Promise<void> {
    const hasher = new BcryptPasswordHasher();
    const organizer = AdminUser.invite({
      tenantId,
      name: 'Seed Organizer',
      email: organizerEmail,
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

  async function loginAsOrganizer(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/login`)
      .send({ email: organizerEmail, password: 'organizer-password' })
      .expect(200);
    return (response.body as LoginResponseBody).accessToken;
  }

  async function createOpenFestival(token: string, number: number, year: number) {
    const createResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        number,
        year,
        name: `FENAC ${year}`,
        registrationBegin: '2020-01-01T00:00:00.000Z',
        registrationEnd: '2099-01-01T00:00:00.000Z',
        inscriptionFee: 25,
      })
      .expect(201);
    const festival = createResponse.body as FestivalResponseBody;
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return festival;
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
        name: 'Registrations E2E Tenant',
        document: 'RR123456789012',
        slug: tenantSlug,
        status: 'ACTIVE',
      },
    });
    tenantId = tenant.id;
    await seedActiveOrganizer();
  });

  afterAll(async () => {
    await prisma.registration.deleteMany({ where: { tenantId } });
    await prisma.festival.deleteMany({ where: { tenantId } });
    await prisma.adminUser.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  it('creates a registration for an OPEN festival and lists it both scoped and globally', async () => {
    const token = await loginAsOrganizer();
    const festival = await createOpenFestival(token, 90, 2090);

    const createResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/registrations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
      })
      .expect(201);
    const registration = createResponse.body as RegistrationResponseBody;
    expect(registration.festivalId).toBe(festival.id);
    expect(registration.festivalNumber).toBe(90);

    const byFestivalResponse = await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/festivals/${festival.id}/registrations`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(byFestivalResponse.body as RegistrationResponseBody[]).toHaveLength(1);

    const allResponse = await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/registrations`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const all = allResponse.body as RegistrationResponseBody[];
    expect(all.some((r) => r.id === registration.id)).toBe(true);
  });

  it('allows the same participant to submit a second song to the same festival', async () => {
    const token = await loginAsOrganizer();
    const festival = await createOpenFestival(token, 91, 2091);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/registrations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/registrations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Banhar o Corpo',
        performers: 'Mai Sato: Canto e Harpa',
      })
      .expect(201);
  });

  it('returns 409, not 500, when the festival is still DRAFT', async () => {
    const token = await loginAsOrganizer();
    const createResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        number: 92,
        year: 2092,
        name: 'FENAC 2092',
        registrationBegin: '2020-01-01T00:00:00.000Z',
        registrationEnd: '2099-01-01T00:00:00.000Z',
        inscriptionFee: 25,
      })
      .expect(201);
    const festival = createResponse.body as FestivalResponseBody;

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/registrations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
      })
      .expect(409);
  });

  it('returns 400, not 500, when participantCpf is not 11 digits', async () => {
    const token = await loginAsOrganizer();
    const festival = await createOpenFestival(token, 93, 2093);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/registrations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '123',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
      })
      .expect(400);
  });

  it('rejects creating a registration with no auth token', async () => {
    const token = await loginAsOrganizer();
    const festival = await createOpenFestival(token, 94, 2094);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/festivals/${festival.id}/registrations`)
      .send({
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
      })
      .expect(401);
  });
});
