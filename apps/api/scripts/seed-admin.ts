import { PrismaClient } from '@prisma/client';
import { Tenant } from '../src/tenants/domain/tenant.entity';
import { AdminUser } from '../src/admin-identity/domain/admin-user.entity';
import { BcryptPasswordHasher } from '../src/identity/infrastructure/bcrypt-password-hasher';

const TENANT_SLUG = 'fenac';
const TENANT_NAME = 'FENAC — Festival Nacional da Canção';
const TENANT_DOCUMENT = 'FE000000000001';
const ADMIN_EMAIL = 'admin@fenac.local';

async function main() {
  const prisma = new PrismaClient();
  const hasher = new BcryptPasswordHasher();

  try {
    let tenantRow = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });

    if (!tenantRow) {
      const tenant = Tenant.create({
        name: TENANT_NAME,
        document: TENANT_DOCUMENT,
        slug: TENANT_SLUG,
      });
      tenantRow = await prisma.tenant.create({
        data: {
          id: tenant.id,
          name: tenant.name,
          document: tenant.document,
          slug: tenant.slug,
          status: tenant.status,
          createdAt: tenant.createdAt,
        },
      });
      console.log(`Created tenant "${TENANT_SLUG}" (${tenantRow.id})`);
    } else {
      console.log(`Tenant "${TENANT_SLUG}" already exists (${tenantRow.id})`);
    }

    const existingAdmin = await prisma.adminUser.findUnique({
      where: { tenantId_email: { tenantId: tenantRow.id, email: ADMIN_EMAIL } },
    });

    if (existingAdmin) {
      console.log(`Admin "${ADMIN_EMAIL}" already exists for tenant "${TENANT_SLUG}" — nothing to do.`);
      return;
    }

    const password = process.env.SEED_ADMIN_PASSWORD ?? generatePassword();
    const admin = AdminUser.invite({
      tenantId: tenantRow.id,
      name: 'Organizador FENAC',
      email: ADMIN_EMAIL,
      role: 'ORGANIZER',
    }).activate(await hasher.hash(password));

    await prisma.adminUser.create({
      data: {
        id: admin.id,
        tenantId: admin.tenantId,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        passwordHash: admin.passwordHash,
        inviteToken: admin.inviteToken,
      },
    });

    console.log('Created ORGANIZER admin:');
    console.log(`  email:    ${ADMIN_EMAIL}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log(`  password: ${password}  (generated — save it, it is not stored anywhere else)`);
    } else {
      console.log('  password: (from SEED_ADMIN_PASSWORD)');
    }
  } finally {
    await prisma.$disconnect();
  }
}

function generatePassword(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
