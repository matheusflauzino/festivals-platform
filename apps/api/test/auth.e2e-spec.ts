import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface LoginResponseBody {
  accessToken: string;
  user: AuthUser;
}

interface RefreshResponseBody {
  accessToken: string;
}

interface MeResponseBody {
  id: string;
  name: string;
  email: string;
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantSlug = 'auth-e2e-tenant';
  const userEmail = 'auth-e2e-user@example.com';
  const secondUserEmail = 'auth-e2e-second-user@example.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.tenant.create({
      data: {
        id: 'auth-e2e-tenant-id',
        name: 'Auth E2E Tenant',
        document: 'AE123456789012',
        slug: tenantSlug,
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [userEmail, secondUserEmail] } },
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: tenantSlug } });
    await app.close();
  });

  it('registers, logs in, and refreshes an access token', async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/register`)
      .send({
        name: 'Ana Silva',
        email: userEmail,
        cpf: '12345678901',
        password: 'a-strong-password',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/login`)
      .send({ identifier: userEmail, password: 'a-strong-password' })
      .expect(200);

    const loginBody = loginResponse.body as LoginResponseBody;
    expect(loginBody.accessToken).toBeDefined();
    expect(loginBody.user.email).toBe(userEmail);
    const setCookieHeader = loginResponse.headers['set-cookie'];
    expect(setCookieHeader[0]).toContain('refreshToken=');

    const refreshResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/refresh`)
      .set('Cookie', setCookieHeader)
      .expect(200);

    const refreshBody = refreshResponse.body as RefreshResponseBody;
    expect(refreshBody.accessToken).toBeDefined();
  });

  it('returns 401 for a login with the wrong password', async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/register`)
      .send({
        name: 'Ana Silva',
        email: userEmail,
        cpf: '12345678901',
        password: 'a-strong-password',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/login`)
      .send({ identifier: userEmail, password: 'wrong-password' })
      .expect(401);
  });

  it('returns 404 when the tenant slug does not exist', async () => {
    await request(app.getHttpServer())
      .post('/tenants/does-not-exist/auth/login')
      .send({ identifier: userEmail, password: 'anything' })
      .expect(404);
  });

  it('returns the authenticated participant on /me, and 401 without a token', async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/register`)
      .send({
        name: 'Ana Silva',
        email: userEmail,
        cpf: '12345678901',
        password: 'a-strong-password',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/login`)
      .send({ identifier: userEmail, password: 'a-strong-password' })
      .expect(200);

    const accessToken = (loginResponse.body as LoginResponseBody).accessToken;

    const meResponse = await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const meBody = meResponse.body as MeResponseBody;
    expect(meBody.email).toBe(userEmail);

    await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/auth/me`)
      .expect(401);
  });

  it("returns each participant their own data on /me, not another user's", async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/register`)
      .send({
        name: 'Ana Silva',
        email: userEmail,
        cpf: '12345678901',
        password: 'a-strong-password',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/register`)
      .send({
        name: 'Bruno Costa',
        email: secondUserEmail,
        cpf: '98765432100',
        password: 'another-strong-password',
      })
      .expect(201);

    const firstLogin = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/login`)
      .send({ identifier: userEmail, password: 'a-strong-password' })
      .expect(200);
    const secondLogin = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/login`)
      .send({
        identifier: secondUserEmail,
        password: 'another-strong-password',
      })
      .expect(200);

    const firstAccessToken = (firstLogin.body as LoginResponseBody).accessToken;
    const secondAccessToken = (secondLogin.body as LoginResponseBody)
      .accessToken;

    const firstMeResponse = await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/auth/me`)
      .set('Authorization', `Bearer ${firstAccessToken}`)
      .expect(200);
    const secondMeResponse = await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/auth/me`)
      .set('Authorization', `Bearer ${secondAccessToken}`)
      .expect(200);

    const firstMeBody = firstMeResponse.body as MeResponseBody;
    const secondMeBody = secondMeResponse.body as MeResponseBody;
    expect(firstMeBody.email).toBe(userEmail);
    expect(firstMeBody.name).toBe('Ana Silva');
    expect(secondMeBody.email).toBe(secondUserEmail);
    expect(secondMeBody.name).toBe('Bruno Costa');
    expect(firstMeBody.id).not.toBe(secondMeBody.id);
  });
});
