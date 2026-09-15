import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('TenantsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = 'e2e-test-tenant';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.tenant.deleteMany({ where: { slug } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a tenant then finds it by slug', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/tenants')
      .send({ name: 'E2E Test Tenant', document: 'AB123456789012', slug })
      .expect(201);

    expect(createResponse.body.slug).toBe(slug);

    const getResponse = await request(app.getHttpServer())
      .get(`/tenants/${slug}`)
      .expect(200);

    expect(getResponse.body.id).toBe(createResponse.body.id);
  });

  it('returns 400 for an invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/tenants')
      .send({ name: 'X', document: 'too-short', slug })
      .expect(400);
  });

  it('returns 404 for an unknown slug', async () => {
    await request(app.getHttpServer()).get('/tenants/does-not-exist').expect(404);
  });
});
