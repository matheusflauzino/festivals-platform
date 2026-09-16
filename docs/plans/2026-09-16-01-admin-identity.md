# Admin Identity & Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build invite-only admin (organizer/jury/committee) authentication with role-based access control and audit logging for the admin portal, on a new `admin-identity` module — and, since this is the first place the spec's automatic tenant-scoping mechanism is genuinely needed, introduce the generic `TenantScopedRepository` base class it calls for.

**Architecture:** A new `apps/api/src/admin-identity` module, layered the same way as `identity` and `tenants` (domain → application → infrastructure). `AdminUser` is tenant-scoped (email unique per tenant), created only via invite (no self-registration) by an existing `ORGANIZER`, activated by the invitee setting a password via a one-time token. Admin JWTs are issued by a dedicated `AdminTokenService` — a separate module, separate env secret, separate `role` claim from participant tokens — not a shared service with an `isAdmin` flag, per the architectural note carried over from the previous plan's final review. `PrismaAdminUsersRepository` is the first consumer of a new `TenantScopedRepository` base class (`apps/api/src/common/repositories/`), which centralizes the `where: { tenantId }` injection the spec calls for instead of each repository writing it by hand — the existing participant `PrismaUsersRepository` is deliberately left as-is (YAGNI; retrofitting reviewed, shipped code is a separate future task, not bundled here).

**Tech Stack:** NestJS, `@nestjs/jwt` (already a dependency), `bcryptjs` (already a dependency — password hashing is reused via the existing `PasswordHasherPort`/`BcryptPasswordHasher`, not duplicated), Prisma/MySQL, Jest.

**Spec:** `docs/specs/2026-09-15-fenac-platform-architecture-design.md` (§2 Clean Architecture + multi-tenancy mechanism, §3 Auth — admin side).

## Global Constraints

- Clean Architecture per module: `domain` (zero NestJS/Prisma dependency) → `application` (use cases + ports; `@Injectable`/`@Inject` accepted as pragmatic convention) → `infrastructure` (Prisma repositories, guards, interceptors, controllers).
- TDD mandatory: failing test before implementation, every task.
- Always install packages with the `@latest` tag, then verify actual installed behavior empirically rather than trusting training-data assumptions — this project has hit several real breaking changes this way. (This plan adds no new dependencies, but the constraint still governs any `pnpm add` a task ends up needing.)
- Multi-tenancy: `AdminUser` carries `tenantId`; email uniqueness is enforced **per tenant** (`@@unique([tenantId, email])`), not globally. Every `AdminUser` query goes through `TenantScopedRepository`, never a hand-written `where: { tenantId }`.
- Admin auth: invite-only (no self-registration endpoint), email + password, no 2FA. Roles: `ORGANIZER`, `JUDGE`, `COMMITTEE`. Only `ORGANIZER` can invite.
- Admin JWTs are issued by a dedicated `AdminTokenService`, with their own env secret (`ADMIN_JWT_SECRET`, distinct from participants' `JWT_SECRET` — a leaked participant secret must not be able to forge an admin token or vice versa), their own access/refresh `type` claims (learn from the participant plan's final review: type these from the start, don't retrofit), and a `role` claim.
- Audit logging: sensitive admin actions get an `AuditLog` row (actor admin id, tenant id, action, target type/id, timestamp). This plan's own concrete consumer is the invite action; the interceptor/decorator built here is reusable by future admin actions (e.g. a later plan's "admin edits a participant's email/CPF/password" flow, per the original brainstorming decision), which this plan does not implement.
- Follow the existing modules' patterns exactly: static-factory (`.create`/`.restore`-style) immutable entities, `XxxRepositoryPort` interfaces with a `Symbol` DI token, `InMemoryXxxRepository` test doubles, Prisma repositories reconstructing entities via `.restore()`.
- Known, accepted gap carried forward explicitly (not fixed by this plan): there is no HTTP-level way to create the very first `ORGANIZER` of a tenant, since invite requires an existing `ORGANIZER` — for FENAC this is resolved by the future legacy-data migration plan (which will port existing admins as already-`ACTIVE`); for this plan's own tests, the first organizer is seeded directly via Prisma, the same way tenants are already seeded directly in existing e2e tests.

---

### Task 1: Prisma schema — `AdminUser`, `AuditLog`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `AdminRole` (`ORGANIZER`/`JUDGE`/`COMMITTEE`), `AdminStatus` (`PENDING`/`ACTIVE`) enums; `AdminUser` and `AuditLog` Prisma models. Every later task in this plan depends on these.

- [ ] **Step 1: Add the models**

Add to `apps/api/prisma/schema.prisma` (after the existing `User` model):

```prisma
enum AdminRole {
  ORGANIZER
  JUDGE
  COMMITTEE
}

enum AdminStatus {
  PENDING
  ACTIVE
}

model AdminUser {
  id           String      @id @default(uuid())
  tenantId     String      @map("tenant_id")
  tenant       Tenant      @relation(fields: [tenantId], references: [id])
  name         String
  email        String
  passwordHash String?     @map("password_hash")
  role         AdminRole
  status       AdminStatus @default(PENDING)
  inviteToken  String?     @unique @map("invite_token")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")

  @@unique([tenantId, email])
  @@map("admin_users")
}

model AuditLog {
  id            String   @id @default(uuid())
  tenantId      String   @map("tenant_id")
  actorAdminId  String   @map("actor_admin_id")
  action        String
  targetType    String   @map("target_type")
  targetId      String   @map("target_id")
  createdAt     DateTime @default(now()) @map("created_at")

  @@map("audit_logs")
}
```

Add `adminUsers AdminUser[]` to the existing `Tenant` model, alongside its existing `users User[]` line.

- [ ] **Step 2: Run the migration**

Ensure MySQL is up: `docker compose up -d mysql`
Run: `cd apps/api && pnpm exec prisma migrate dev --name add_admin_users_and_audit_log`
Expected: creates a new migration, applies it, regenerates the Prisma Client.

- [ ] **Step 3: Verify the client picked up the new models**

Run: `cd apps/api && node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.adminUser.findMany, typeof p.auditLog.findMany);"`
Expected: `function function`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(prisma): add AdminUser and AuditLog models"
```

---

### Task 2: `TenantScopedRepository` generic base class (TDD)

**Files:**
- Create: `apps/api/src/common/repositories/tenant-scoped.repository.ts`
- Create: `apps/api/src/common/repositories/tenant-scoped.repository.spec.ts`

**Interfaces:**
- Produces: `abstract class TenantScopedRepository { protected tenantScoped(tenantId: string, where?: object): object }` — a protected helper that merges `tenantId` into a where clause. Task 4's `PrismaAdminUsersRepository` extends this and uses `this.tenantScoped(...)` instead of spreading `tenantId` by hand.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/repositories/tenant-scoped.repository.spec.ts`:

```typescript
import { TenantScopedRepository } from './tenant-scoped.repository';

class TestRepository extends TenantScopedRepository {
  buildWhere(tenantId: string, extra?: object) {
    return this.tenantScoped(tenantId, extra);
  }
}

describe('TenantScopedRepository', () => {
  it('injects tenantId into an empty where clause', () => {
    const repo = new TestRepository();
    expect(repo.buildWhere('tenant-1')).toEqual({ tenantId: 'tenant-1' });
  });

  it('merges tenantId alongside other where conditions', () => {
    const repo = new TestRepository();
    expect(repo.buildWhere('tenant-1', { email: 'ana@example.com' })).toEqual({
      email: 'ana@example.com',
      tenantId: 'tenant-1',
    });
  });

  it('does not let a caller-supplied tenantId override the real one', () => {
    const repo = new TestRepository();
    expect(repo.buildWhere('tenant-1', { tenantId: 'attacker-tenant' })).toEqual({
      tenantId: 'tenant-1',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test tenant-scoped.repository.spec.ts`
Expected: FAIL — `Cannot find module './tenant-scoped.repository'`.

- [ ] **Step 3: Implement `TenantScopedRepository`**

Create `apps/api/src/common/repositories/tenant-scoped.repository.ts`:

```typescript
export abstract class TenantScopedRepository {
  protected tenantScoped(tenantId: string, where: object = {}): object {
    return { ...where, tenantId };
  }
}
```

(The spread order — `where` first, `tenantId` second — is what makes Step 1's third test case pass: any `tenantId` key already present in `where` gets overwritten by the real one.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test tenant-scoped.repository.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/repositories
git commit -m "feat(common): add TenantScopedRepository base class"
```

---

### Task 3: `AdminUser` domain entity (TDD)

**Files:**
- Create: `apps/api/src/admin-identity/domain/admin-user.entity.ts`
- Create: `apps/api/src/admin-identity/domain/admin-user.entity.spec.ts`

**Interfaces:**
- Produces: `AdminUser.invite({tenantId, name, email, role}): AdminUser` (throws on invalid email/role, generates its own `id` and a random `inviteToken`, status `PENDING`, `passwordHash` null), `AdminUser.restore(props): AdminUser`, `.activate(passwordHash: string): AdminUser` (returns a new instance with status `ACTIVE`, the given `passwordHash`, `inviteToken` cleared to `null`; throws if not currently `PENDING`), getters `.id/.tenantId/.name/.email/.role/.status/.passwordHash/.inviteToken/.createdAt`. Task 4's repository and Tasks 8-10's use cases depend on these exact names.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/admin-identity/domain/admin-user.entity.spec.ts`:

```typescript
import { AdminUser } from './admin-user.entity';

describe('AdminUser', () => {
  const validInput = {
    tenantId: 'tenant-1',
    name: 'Carlos Souza',
    email: 'carlos@example.com',
    role: 'ORGANIZER' as const,
  };

  it('creates a pending invite with a generated token and no password', () => {
    const admin = AdminUser.invite(validInput);

    expect(admin.id).toBeDefined();
    expect(admin.status).toBe('PENDING');
    expect(admin.passwordHash).toBeNull();
    expect(admin.inviteToken).toBeDefined();
    expect(admin.inviteToken).not.toBeNull();
    expect((admin.inviteToken as string).length).toBeGreaterThanOrEqual(32);
  });

  it('rejects an invalid email', () => {
    expect(() => AdminUser.invite({ ...validInput, email: 'not-an-email' })).toThrow(
      'invalid email',
    );
  });

  it('rejects an invalid role', () => {
    expect(() =>
      // @ts-expect-error deliberately invalid for this test
      AdminUser.invite({ ...validInput, role: 'SUPERADMIN' }),
    ).toThrow('invalid role');
  });

  it('activates a pending admin, setting the password hash and clearing the invite token', () => {
    const admin = AdminUser.invite(validInput);
    const activated = admin.activate('hashed-password');

    expect(activated.status).toBe('ACTIVE');
    expect(activated.passwordHash).toBe('hashed-password');
    expect(activated.inviteToken).toBeNull();
    expect(activated.id).toBe(admin.id);
  });

  it('rejects activating an already-active admin', () => {
    const admin = AdminUser.invite(validInput).activate('hashed-password');
    expect(() => admin.activate('other-hash')).toThrow('admin already active');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test admin-user.entity.spec.ts`
Expected: FAIL — `Cannot find module './admin-user.entity'`.

- [ ] **Step 3: Implement `AdminUser`**

Create `apps/api/src/admin-identity/domain/admin-user.entity.ts`:

```typescript
import { randomBytes, randomUUID } from 'crypto';

export type AdminRole = 'ORGANIZER' | 'JUDGE' | 'COMMITTEE';
export type AdminStatus = 'PENDING' | 'ACTIVE';

export interface AdminUserProps {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  passwordHash: string | null;
  inviteToken: string | null;
  createdAt: Date;
}

export interface InviteAdminUserInput {
  tenantId: string;
  name: string;
  email: string;
  role: AdminRole;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: AdminRole[] = ['ORGANIZER', 'JUDGE', 'COMMITTEE'];

export class AdminUser {
  private constructor(private readonly props: AdminUserProps) {}

  static invite(input: InviteAdminUserInput): AdminUser {
    if (!EMAIL_PATTERN.test(input.email)) {
      throw new Error('invalid email');
    }
    if (!VALID_ROLES.includes(input.role)) {
      throw new Error('invalid role');
    }

    return new AdminUser({
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      role: input.role,
      status: 'PENDING',
      passwordHash: null,
      inviteToken: randomBytes(32).toString('hex'),
      createdAt: new Date(),
    });
  }

  static restore(props: AdminUserProps): AdminUser {
    return new AdminUser(props);
  }

  activate(passwordHash: string): AdminUser {
    if (this.props.status !== 'PENDING') {
      throw new Error('admin already active');
    }
    return new AdminUser({
      ...this.props,
      status: 'ACTIVE',
      passwordHash,
      inviteToken: null,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get role(): AdminRole {
    return this.props.role;
  }

  get status(): AdminStatus {
    return this.props.status;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  get inviteToken(): string | null {
    return this.props.inviteToken;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test admin-user.entity.spec.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin-identity
git commit -m "feat(admin-identity): add AdminUser domain entity"
```

---

### Task 4: `AdminUsersRepositoryPort` + `PrismaAdminUsersRepository` + `InMemoryAdminUsersRepository` (TDD)

**Files:**
- Create: `apps/api/src/admin-identity/application/ports/admin-users-repository.port.ts`
- Create: `apps/api/src/admin-identity/infrastructure/prisma-admin-users.repository.ts`
- Create: `apps/api/src/admin-identity/infrastructure/in-memory-admin-users.repository.ts`
- Test: `apps/api/src/admin-identity/infrastructure/prisma-admin-users.repository.integration-spec.ts`

**Interfaces:**
- Consumes: `AdminUser` (Task 3), `PrismaService` (existing), `TenantScopedRepository` (Task 2).
- Produces: `AdminUsersRepositoryPort.save(admin: AdminUser): Promise<void>`, `.findByEmail(tenantId: string, email: string): Promise<AdminUser | null>`, `.findByInviteToken(token: string): Promise<AdminUser | null>` (global lookup — the token itself is the credential, not tenant-scoped, since an invitee doesn't know their tenant slug until they follow the link), `.findById(tenantId: string, id: string): Promise<AdminUser | null>`, `ADMIN_USERS_REPOSITORY` DI token, `PrismaAdminUsersRepository extends TenantScopedRepository implements AdminUsersRepositoryPort`, `InMemoryAdminUsersRepository implements AdminUsersRepositoryPort`. Tasks 8-10's use cases and Task 13's controller depend on these exact names.

- [ ] **Step 1: Define the port**

Create `apps/api/src/admin-identity/application/ports/admin-users-repository.port.ts`:

```typescript
import { AdminUser } from '../../domain/admin-user.entity';

export interface AdminUsersRepositoryPort {
  save(admin: AdminUser): Promise<void>;
  findByEmail(tenantId: string, email: string): Promise<AdminUser | null>;
  findByInviteToken(token: string): Promise<AdminUser | null>;
  findById(tenantId: string, id: string): Promise<AdminUser | null>;
}

export const ADMIN_USERS_REPOSITORY = Symbol('ADMIN_USERS_REPOSITORY');
```

- [ ] **Step 2: Write the failing integration test**

Create `apps/api/src/admin-identity/infrastructure/prisma-admin-users.repository.integration-spec.ts`:

```typescript
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

    const byToken = await repository.findByInviteToken(admin.inviteToken as string);
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
```

- [ ] **Step 3: Run the test to verify it fails**

Ensure MySQL is up: `docker compose up -d mysql`
Run: `cd apps/api && pnpm run test:integration prisma-admin-users.repository.integration-spec.ts`
Expected: FAIL — `Cannot find module './prisma-admin-users.repository'`.

- [ ] **Step 4: Implement `PrismaAdminUsersRepository`**

Create `apps/api/src/admin-identity/infrastructure/prisma-admin-users.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { AdminUser, AdminUserProps } from '../domain/admin-user.entity';
import { AdminUsersRepositoryPort } from '../application/ports/admin-users-repository.port';

@Injectable()
export class PrismaAdminUsersRepository
  extends TenantScopedRepository
  implements AdminUsersRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(admin: AdminUser): Promise<void> {
    await this.prisma.adminUser.upsert({
      where: { id: admin.id },
      create: {
        id: admin.id,
        tenantId: admin.tenantId,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        passwordHash: admin.passwordHash,
        inviteToken: admin.inviteToken,
        createdAt: admin.createdAt,
      },
      update: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        passwordHash: admin.passwordHash,
        inviteToken: admin.inviteToken,
      },
    });
  }

  async findByEmail(tenantId: string, email: string): Promise<AdminUser | null> {
    const row = await this.prisma.adminUser.findFirst({
      where: this.tenantScoped(tenantId, { email }),
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByInviteToken(token: string): Promise<AdminUser | null> {
    const row = await this.prisma.adminUser.findUnique({ where: { inviteToken: token } });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findById(tenantId: string, id: string): Promise<AdminUser | null> {
    const row = await this.prisma.adminUser.findFirst({
      where: this.tenantScoped(tenantId, { id }),
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    role: string;
    status: string;
    passwordHash: string | null;
    inviteToken: string | null;
    createdAt: Date;
  }): AdminUser {
    return AdminUser.restore({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      email: row.email,
      role: row.role as AdminUserProps['role'],
      status: row.status as AdminUserProps['status'],
      passwordHash: row.passwordHash,
      inviteToken: row.inviteToken,
      createdAt: row.createdAt,
    });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test:integration prisma-admin-users.repository.integration-spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 6: Add the in-memory test double**

Create `apps/api/src/admin-identity/infrastructure/in-memory-admin-users.repository.ts`:

```typescript
import { AdminUser } from '../domain/admin-user.entity';
import { AdminUsersRepositoryPort } from '../application/ports/admin-users-repository.port';

export class InMemoryAdminUsersRepository implements AdminUsersRepositoryPort {
  private readonly admins = new Map<string, AdminUser>();

  async save(admin: AdminUser): Promise<void> {
    this.admins.set(admin.id, admin);
  }

  async findByEmail(tenantId: string, email: string): Promise<AdminUser | null> {
    for (const admin of this.admins.values()) {
      if (admin.tenantId === tenantId && admin.email === email) return admin;
    }
    return null;
  }

  async findByInviteToken(token: string): Promise<AdminUser | null> {
    for (const admin of this.admins.values()) {
      if (admin.inviteToken === token) return admin;
    }
    return null;
  }

  async findById(tenantId: string, id: string): Promise<AdminUser | null> {
    const admin = this.admins.get(id);
    return admin && admin.tenantId === tenantId ? admin : null;
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin-identity
git commit -m "feat(admin-identity): add AdminUser Prisma/in-memory repositories"
```

---

### Task 5: `AdminTokenService` (TDD)

**Files:**
- Create: `apps/api/src/admin-identity/infrastructure/admin-token.service.ts`
- Create: `apps/api/src/admin-identity/infrastructure/admin-token.service.spec.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `AdminTokenService.signAccessToken(payload: {sub: string; tenantId: string; role: AdminRole}): string`, `.signRefreshToken(payload): string`, `.verifyAccessToken(token: string): {sub, tenantId, role}` (throws on invalid/wrong-type token), `.verifyRefreshToken(token: string): {sub, tenantId, role}`. A distinct service and DI-registered `JwtModule` instance from the participant `ParticipantTokenService` — do not import or extend that class. Task 6 (guard) and Task 13 (controller) depend on these exact names.

- [ ] **Step 1: Add `ADMIN_JWT_SECRET` to env files**

Add to `.env.example` (repo root), after the existing `JWT_SECRET` line:

```
ADMIN_JWT_SECRET="dev-only-change-me-admin"
```

Add the same line (with any value) to your local `.env` and `apps/api/.env`.

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/admin-identity/infrastructure/admin-token.service.spec.ts`:

```typescript
import { JwtService } from '@nestjs/jwt';
import { AdminTokenService } from './admin-token.service';

describe('AdminTokenService', () => {
  const jwtService = new JwtService({ secret: 'test-admin-secret' });
  const service = new AdminTokenService(jwtService);

  const payload = { sub: 'admin-1', tenantId: 'tenant-1', role: 'ORGANIZER' as const };

  it('signs and verifies an access token, carrying the role claim', () => {
    const token = service.signAccessToken(payload);
    const decoded = service.verifyAccessToken(token);

    expect(decoded.sub).toBe('admin-1');
    expect(decoded.tenantId).toBe('tenant-1');
    expect(decoded.role).toBe('ORGANIZER');
  });

  it('signs and verifies a refresh token', () => {
    const token = service.signRefreshToken(payload);
    const decoded = service.verifyRefreshToken(token);
    expect(decoded.sub).toBe('admin-1');
  });

  it('rejects a refresh token when checked as an access token', () => {
    const token = service.signRefreshToken(payload);
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it('rejects an access token when checked as a refresh token', () => {
    const token = service.signAccessToken(payload);
    expect(() => service.verifyRefreshToken(token)).toThrow();
  });

  it('rejects a token signed with a different secret', () => {
    const otherService = new AdminTokenService(new JwtService({ secret: 'different-secret' }));
    const token = otherService.signAccessToken(payload);
    expect(() => service.verifyAccessToken(token)).toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test admin-token.service.spec.ts`
Expected: FAIL — `Cannot find module './admin-token.service'`.

- [ ] **Step 4: Implement `AdminTokenService`**

Create `apps/api/src/admin-identity/infrastructure/admin-token.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '../domain/admin-user.entity';

export interface AdminTokenPayload {
  sub: string;
  tenantId: string;
  role: AdminRole;
}

@Injectable()
export class AdminTokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: AdminTokenPayload): string {
    return this.jwtService.sign({ ...payload, type: 'access' }, { expiresIn: '15m' });
  }

  signRefreshToken(payload: AdminTokenPayload): string {
    return this.jwtService.sign({ ...payload, type: 'refresh' }, { expiresIn: '7d' });
  }

  verifyAccessToken(token: string): AdminTokenPayload {
    return this.verifyOfType(token, 'access');
  }

  verifyRefreshToken(token: string): AdminTokenPayload {
    return this.verifyOfType(token, 'refresh');
  }

  private verifyOfType(token: string, type: 'access' | 'refresh'): AdminTokenPayload {
    const payload = this.jwtService.verify<AdminTokenPayload & { type?: string }>(token);
    if (payload.type !== type) {
      throw new Error('wrong token type');
    }
    return { sub: payload.sub, tenantId: payload.tenantId, role: payload.role };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test admin-token.service.spec.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin-identity .env.example
git commit -m "feat(admin-identity): add AdminTokenService (dedicated JWT, role claim)"
```

---

### Task 6: `AdminAuthGuard` (TDD)

**Files:**
- Create: `apps/api/src/admin-identity/infrastructure/admin-auth.guard.ts`
- Create: `apps/api/src/admin-identity/infrastructure/admin-auth.guard.spec.ts`

**Interfaces:**
- Consumes: `AdminTokenService.verifyAccessToken` (Task 5).
- Produces: `AdminAuthGuard` (NestJS `CanActivate`), attaches `request.admin = {id: string; tenantId: string; role: AdminRole}` on success, throws `UnauthorizedException` otherwise. Task 7 (roles guard), Task 11 (audit interceptor), and Task 13 (controller) depend on `request.admin`'s exact shape.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/admin-identity/infrastructure/admin-auth.guard.spec.ts`:

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminTokenService } from './admin-token.service';
import { AdminAuthGuard } from './admin-auth.guard';

function makeContext(authHeader?: string): ExecutionContext {
  const request: { headers: Record<string, string>; admin?: unknown } = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminAuthGuard', () => {
  const tokenService = new AdminTokenService(new JwtService({ secret: 'test-secret' }));
  const guard = new AdminAuthGuard(tokenService);

  it('allows a request with a valid access token and attaches request.admin', () => {
    const token = tokenService.signAccessToken({
      sub: 'admin-1',
      tenantId: 'tenant-1',
      role: 'ORGANIZER',
    });
    const context = makeContext(`Bearer ${token}`);

    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.admin).toEqual({ id: 'admin-1', tenantId: 'tenant-1', role: 'ORGANIZER' });
  });

  it('rejects a request with no authorization header', () => {
    expect(() => guard.canActivate(makeContext())).toThrow(UnauthorizedException);
  });

  it('rejects a request bearing a refresh token instead of an access token', () => {
    const token = tokenService.signRefreshToken({
      sub: 'admin-1',
      tenantId: 'tenant-1',
      role: 'ORGANIZER',
    });
    expect(() => guard.canActivate(makeContext(`Bearer ${token}`))).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test admin-auth.guard.spec.ts`
Expected: FAIL — `Cannot find module './admin-auth.guard'`.

- [ ] **Step 3: Implement `AdminAuthGuard`**

Create `apps/api/src/admin-identity/infrastructure/admin-auth.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AdminRole } from '../domain/admin-user.entity';
import { AdminTokenService } from './admin-token.service';

export interface RequestWithAdmin extends Request {
  admin?: { id: string; tenantId: string; role: AdminRole };
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly tokenService: AdminTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      request.admin = { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test admin-auth.guard.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin-identity
git commit -m "feat(admin-identity): add AdminAuthGuard"
```

---

### Task 7: `RolesGuard` + `@Roles()` decorator (TDD)

**Files:**
- Create: `apps/api/src/common/decorators/roles.decorator.ts`
- Create: `apps/api/src/common/guards/roles.guard.ts`
- Create: `apps/api/src/common/guards/roles.guard.spec.ts`

**Interfaces:**
- Consumes: `request.admin.role` (attached by `AdminAuthGuard`, Task 6).
- Produces: `@Roles(...roles: AdminRole[])` method decorator, `RolesGuard` (NestJS `CanActivate`, reads the decorator's metadata via `Reflector` and checks `request.admin.role` is in the allowed list — throws `ForbiddenException` if not, and if a route has no `@Roles()` decorator at all, allows any authenticated admin through). Task 13's invite endpoint depends on this to restrict itself to `ORGANIZER`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/guards/roles.guard.spec.ts`:

```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(adminRole: string | undefined, requiredRoles: string[] | undefined) {
  const request = { admin: adminRole ? { role: adminRole } : undefined };
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('RolesGuard', () => {
  it('allows the request when the admin role is in the required list', () => {
    const { context, reflector } = makeContext('ORGANIZER', ['ORGANIZER']);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects the request when the admin role is not in the required list', () => {
    const { context, reflector } = makeContext('JUDGE', ['ORGANIZER']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows any authenticated admin when the route has no @Roles() decorator', () => {
    const { context, reflector } = makeContext('JUDGE', undefined);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test roles.guard.spec.ts`
Expected: FAIL — `Cannot find module './roles.guard'`.

- [ ] **Step 3: Implement the decorator and guard**

Create `apps/api/src/common/decorators/roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '../../admin-identity/domain/admin-user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
```

Create `apps/api/src/common/guards/roles.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AdminRole } from '../../admin-identity/domain/admin-user.entity';
import type { RequestWithAdmin } from '../../admin-identity/infrastructure/admin-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    if (!request.admin || !requiredRoles.includes(request.admin.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test roles.guard.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common
git commit -m "feat(common): add Roles decorator and RolesGuard"
```

---

### Task 8: `InviteAdminUserUseCase` (TDD, in-memory)

**Files:**
- Create: `apps/api/src/admin-identity/application/use-cases/invite-admin-user.use-case.ts`
- Create: `apps/api/src/admin-identity/application/use-cases/invite-admin-user.use-case.spec.ts`
- Create: `apps/api/src/admin-identity/domain/admin-conflict.error.ts`

**Interfaces:**
- Consumes: `AdminUser` (Task 3), `AdminUsersRepositoryPort`/`ADMIN_USERS_REPOSITORY` (Task 4).
- Produces: `InviteAdminUserUseCase.execute(input: {tenantId, name, email, role}): Promise<AdminUser>` (throws `AdminConflictError` if the email is already registered in the tenant). Task 13's controller depends on this signature.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/admin-identity/application/use-cases/invite-admin-user.use-case.spec.ts`:

```typescript
import { InviteAdminUserUseCase } from './invite-admin-user.use-case';
import { InMemoryAdminUsersRepository } from '../../infrastructure/in-memory-admin-users.repository';
import { AdminConflictError } from '../../domain/admin-conflict.error';

describe('InviteAdminUserUseCase', () => {
  it('invites a new admin', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new InviteAdminUserUseCase(repository);

    const admin = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    expect(admin.status).toBe('PENDING');
    await expect(repository.findByEmail('tenant-1', 'carlos@example.com')).resolves.toEqual(
      admin,
    );
  });

  it('rejects inviting a duplicate email within the same tenant', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new InviteAdminUserUseCase(repository);

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        name: 'Outro Nome',
        email: 'carlos@example.com',
        role: 'COMMITTEE',
      }),
    ).rejects.toThrow(AdminConflictError);
  });

  it('allows the same email to be invited in a different tenant', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new InviteAdminUserUseCase(repository);

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-2',
        name: 'Carlos Souza',
        email: 'carlos@example.com',
        role: 'JUDGE',
      }),
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test invite-admin-user.use-case.spec.ts`
Expected: FAIL — `Cannot find module './invite-admin-user.use-case'`.

- [ ] **Step 3: Implement `AdminConflictError` and `InviteAdminUserUseCase`**

Create `apps/api/src/admin-identity/domain/admin-conflict.error.ts`:

```typescript
export class AdminConflictError extends Error {
  constructor() {
    super('An admin with this email is already registered for this tenant');
    this.name = 'AdminConflictError';
  }
}
```

Create `apps/api/src/admin-identity/application/use-cases/invite-admin-user.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { AdminUser, InviteAdminUserInput } from '../../domain/admin-user.entity';
import { AdminConflictError } from '../../domain/admin-conflict.error';
import {
  ADMIN_USERS_REPOSITORY,
  AdminUsersRepositoryPort,
} from '../ports/admin-users-repository.port';

@Injectable()
export class InviteAdminUserUseCase {
  constructor(
    @Inject(ADMIN_USERS_REPOSITORY)
    private readonly adminUsersRepository: AdminUsersRepositoryPort,
  ) {}

  async execute(input: InviteAdminUserInput): Promise<AdminUser> {
    const existing = await this.adminUsersRepository.findByEmail(input.tenantId, input.email);
    if (existing) {
      throw new AdminConflictError();
    }

    const admin = AdminUser.invite(input);
    await this.adminUsersRepository.save(admin);
    return admin;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test invite-admin-user.use-case.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin-identity
git commit -m "feat(admin-identity): add InviteAdminUserUseCase"
```

---

### Task 9: `AcceptAdminInviteUseCase` (TDD, in-memory)

**Files:**
- Create: `apps/api/src/admin-identity/application/use-cases/accept-admin-invite.use-case.ts`
- Create: `apps/api/src/admin-identity/application/use-cases/accept-admin-invite.use-case.spec.ts`
- Create: `apps/api/src/admin-identity/domain/invalid-invite.error.ts`

**Interfaces:**
- Consumes: `AdminUser`, `AdminUsersRepositoryPort`/`ADMIN_USERS_REPOSITORY`, `PasswordHasherPort`/`PASSWORD_HASHER` (existing, from `apps/api/src/identity/application/ports/password-hasher.port.ts` — reused, not duplicated).
- Produces: `AcceptAdminInviteUseCase.execute(input: {token: string; password: string}): Promise<AdminUser>` (throws `InvalidInviteError` if the token doesn't resolve to a `PENDING` admin). Task 13's controller depends on this signature.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/admin-identity/application/use-cases/accept-admin-invite.use-case.spec.ts`:

```typescript
import { AcceptAdminInviteUseCase } from './accept-admin-invite.use-case';
import { InviteAdminUserUseCase } from './invite-admin-user.use-case';
import { InMemoryAdminUsersRepository } from '../../infrastructure/in-memory-admin-users.repository';
import { InvalidInviteError } from '../../domain/invalid-invite.error';
import { PasswordHasherPort } from '../../../identity/application/ports/password-hasher.port';

class FakePasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

describe('AcceptAdminInviteUseCase', () => {
  it('activates the admin for a valid invite token', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const hasher = new FakePasswordHasher();
    const invited = await new InviteAdminUserUseCase(repository).execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    const useCase = new AcceptAdminInviteUseCase(repository, hasher);
    const activated = await useCase.execute({
      token: invited.inviteToken as string,
      password: 'a-strong-password',
    });

    expect(activated.status).toBe('ACTIVE');
    expect(activated.passwordHash).toBe('hashed:a-strong-password');
  });

  it('rejects an unknown token', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new AcceptAdminInviteUseCase(repository, new FakePasswordHasher());

    await expect(
      useCase.execute({ token: 'does-not-exist', password: 'a-strong-password' }),
    ).rejects.toThrow(InvalidInviteError);
  });

  it('rejects reusing an already-accepted token', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const hasher = new FakePasswordHasher();
    const invited = await new InviteAdminUserUseCase(repository).execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });

    const useCase = new AcceptAdminInviteUseCase(repository, hasher);
    const token = invited.inviteToken as string;
    await useCase.execute({ token, password: 'first-password' });

    await expect(useCase.execute({ token, password: 'second-password' })).rejects.toThrow(
      InvalidInviteError,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test accept-admin-invite.use-case.spec.ts`
Expected: FAIL — `Cannot find module './accept-admin-invite.use-case'`.

- [ ] **Step 3: Implement `InvalidInviteError` and `AcceptAdminInviteUseCase`**

Create `apps/api/src/admin-identity/domain/invalid-invite.error.ts`:

```typescript
export class InvalidInviteError extends Error {
  constructor() {
    super('invalid or already-used invite token');
    this.name = 'InvalidInviteError';
  }
}
```

Create `apps/api/src/admin-identity/application/use-cases/accept-admin-invite.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { AdminUser } from '../../domain/admin-user.entity';
import { InvalidInviteError } from '../../domain/invalid-invite.error';
import {
  ADMIN_USERS_REPOSITORY,
  AdminUsersRepositoryPort,
} from '../ports/admin-users-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../identity/application/ports/password-hasher.port';

export interface AcceptAdminInviteInput {
  token: string;
  password: string;
}

@Injectable()
export class AcceptAdminInviteUseCase {
  constructor(
    @Inject(ADMIN_USERS_REPOSITORY)
    private readonly adminUsersRepository: AdminUsersRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AcceptAdminInviteInput): Promise<AdminUser> {
    const admin = await this.adminUsersRepository.findByInviteToken(input.token);
    if (!admin || admin.status !== 'PENDING') {
      throw new InvalidInviteError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const activated = admin.activate(passwordHash);
    await this.adminUsersRepository.save(activated);
    return activated;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test accept-admin-invite.use-case.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin-identity
git commit -m "feat(admin-identity): add AcceptAdminInviteUseCase"
```

---

### Task 10: `AuthenticateAdminUserUseCase` (TDD, in-memory)

**Files:**
- Create: `apps/api/src/admin-identity/application/use-cases/authenticate-admin-user.use-case.ts`
- Create: `apps/api/src/admin-identity/application/use-cases/authenticate-admin-user.use-case.spec.ts`
- Create: `apps/api/src/admin-identity/domain/invalid-admin-credentials.error.ts`

**Interfaces:**
- Consumes: `AdminUser`, `AdminUsersRepositoryPort`/`ADMIN_USERS_REPOSITORY`, `PasswordHasherPort`/`PASSWORD_HASHER` (reused from `identity`).
- Produces: `AuthenticateAdminUserUseCase.execute(input: {tenantId, email, password}): Promise<AdminUser>` (throws `InvalidAdminCredentialsError`, identical for unknown email, wrong password, AND a `PENDING` admin trying to log in before accepting their invite — anti-enumeration, matching the participant module's pattern). Task 13's controller depends on this signature.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/admin-identity/application/use-cases/authenticate-admin-user.use-case.spec.ts`:

```typescript
import { AuthenticateAdminUserUseCase } from './authenticate-admin-user.use-case';
import { InviteAdminUserUseCase } from './invite-admin-user.use-case';
import { AcceptAdminInviteUseCase } from './accept-admin-invite.use-case';
import { InMemoryAdminUsersRepository } from '../../infrastructure/in-memory-admin-users.repository';
import { InvalidAdminCredentialsError } from '../../domain/invalid-admin-credentials.error';
import { PasswordHasherPort } from '../../../identity/application/ports/password-hasher.port';

class FakePasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

async function inviteAndActivate(
  repository: InMemoryAdminUsersRepository,
  hasher: PasswordHasherPort,
) {
  const invited = await new InviteAdminUserUseCase(repository).execute({
    tenantId: 'tenant-1',
    name: 'Carlos Souza',
    email: 'carlos@example.com',
    role: 'ORGANIZER',
  });
  await new AcceptAdminInviteUseCase(repository, hasher).execute({
    token: invited.inviteToken as string,
    password: 'correct-password',
  });
}

describe('AuthenticateAdminUserUseCase', () => {
  it('authenticates an active admin with the correct password', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const hasher = new FakePasswordHasher();
    await inviteAndActivate(repository, hasher);

    const useCase = new AuthenticateAdminUserUseCase(repository, hasher);
    const admin = await useCase.execute({
      tenantId: 'tenant-1',
      email: 'carlos@example.com',
      password: 'correct-password',
    });

    expect(admin.email).toBe('carlos@example.com');
  });

  it('rejects the wrong password', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const hasher = new FakePasswordHasher();
    await inviteAndActivate(repository, hasher);

    const useCase = new AuthenticateAdminUserUseCase(repository, hasher);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', email: 'carlos@example.com', password: 'wrong' }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });

  it('rejects an unknown email', async () => {
    const repository = new InMemoryAdminUsersRepository();
    const useCase = new AuthenticateAdminUserUseCase(repository, new FakePasswordHasher());

    await expect(
      useCase.execute({ tenantId: 'tenant-1', email: 'nobody@example.com', password: 'x' }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });

  it('rejects a still-pending admin (has not accepted the invite yet)', async () => {
    const repository = new InMemoryAdminUsersRepository();
    await new InviteAdminUserUseCase(repository).execute({
      tenantId: 'tenant-1',
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'ORGANIZER',
    });

    const useCase = new AuthenticateAdminUserUseCase(repository, new FakePasswordHasher());
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        email: 'carlos@example.com',
        password: 'anything',
      }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test authenticate-admin-user.use-case.spec.ts`
Expected: FAIL — `Cannot find module './authenticate-admin-user.use-case'`.

- [ ] **Step 3: Implement `InvalidAdminCredentialsError` and `AuthenticateAdminUserUseCase`**

Create `apps/api/src/admin-identity/domain/invalid-admin-credentials.error.ts`:

```typescript
export class InvalidAdminCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidAdminCredentialsError';
  }
}
```

Create `apps/api/src/admin-identity/application/use-cases/authenticate-admin-user.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { AdminUser } from '../../domain/admin-user.entity';
import { InvalidAdminCredentialsError } from '../../domain/invalid-admin-credentials.error';
import {
  ADMIN_USERS_REPOSITORY,
  AdminUsersRepositoryPort,
} from '../ports/admin-users-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../identity/application/ports/password-hasher.port';

export interface AuthenticateAdminUserInput {
  tenantId: string;
  email: string;
  password: string;
}

@Injectable()
export class AuthenticateAdminUserUseCase {
  constructor(
    @Inject(ADMIN_USERS_REPOSITORY)
    private readonly adminUsersRepository: AdminUsersRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AuthenticateAdminUserInput): Promise<AdminUser> {
    const admin = await this.adminUsersRepository.findByEmail(input.tenantId, input.email);
    if (!admin || admin.status !== 'ACTIVE' || !admin.passwordHash) {
      throw new InvalidAdminCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(input.password, admin.passwordHash);
    if (!passwordMatches) {
      throw new InvalidAdminCredentialsError();
    }

    return admin;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test authenticate-admin-user.use-case.spec.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin-identity
git commit -m "feat(admin-identity): add AuthenticateAdminUserUseCase"
```

---

### Task 11: `AuditLogInterceptor` + `@AuditLog()` decorator (TDD)

**Files:**
- Create: `apps/api/src/common/decorators/audit-log.decorator.ts`
- Create: `apps/api/src/common/interceptors/audit-log.interceptor.ts`
- Create: `apps/api/src/common/interceptors/audit-log.interceptor.spec.ts`

**Interfaces:**
- Consumes: `request.admin` (attached by `AdminAuthGuard`, Task 6), `PrismaService` (existing).
- Produces: `@AuditLog(action: string, targetTypeExtractor?: (result: unknown) => {targetType: string; targetId: string})` method decorator, `AuditLogInterceptor` (NestJS `NestInterceptor`) — after the handler succeeds, writes one `AuditLog` row (`tenantId`/`actorAdminId` from `request.admin`, `action` from the decorator, `targetType`/`targetId` from the extractor applied to the handler's return value, defaulting to `{targetType: 'unknown', targetId: 'unknown'}` if no extractor is given). If the handler throws, no row is written. Task 13's invite endpoint depends on this.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/interceptors/audit-log.interceptor.spec.ts`:

```typescript
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import type { AuditLogMetadata } from '../decorators/audit-log.decorator';

describe('AuditLogInterceptor', () => {
  function makeContextAndHandler(
    metadata: AuditLogMetadata | undefined,
    handlerResult: unknown,
    shouldThrow = false,
  ) {
    const request = { admin: { id: 'admin-1', tenantId: 'tenant-1', role: 'ORGANIZER' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const handler: CallHandler = {
      handle: () => (shouldThrow ? throwError(() => new Error('boom')) : of(handlerResult)),
    };

    const reflector = { get: () => metadata } as unknown as Reflector;

    return { context, handler, reflector };
  }

  it('writes an audit log row after a successful handler execution', (done) => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue(undefined) } };
    const metadata: AuditLogMetadata = {
      action: 'invited_admin',
      extractTarget: (result: unknown) => ({
        targetType: 'AdminUser',
        targetId: (result as { id: string }).id,
      }),
    };
    const { context, handler, reflector } = makeContextAndHandler(metadata, { id: 'new-admin-1' });

    const interceptor = new AuditLogInterceptor(reflector, prisma as never);

    interceptor.intercept(context, handler).subscribe(() => {
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          actorAdminId: 'admin-1',
          action: 'invited_admin',
          targetType: 'AdminUser',
          targetId: 'new-admin-1',
        },
      });
      done();
    });
  });

  it('does not write a row when the route has no @AuditLog() decorator', (done) => {
    const prisma = { auditLog: { create: jest.fn() } };
    const { context, handler, reflector } = makeContextAndHandler(undefined, { id: 'x' });
    const interceptor = new AuditLogInterceptor(reflector, prisma as never);

    interceptor.intercept(context, handler).subscribe(() => {
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      done();
    });
  });

  it('does not write a row when the handler throws', (done) => {
    const prisma = { auditLog: { create: jest.fn() } };
    const metadata: AuditLogMetadata = { action: 'invited_admin' };
    const { context, handler, reflector } = makeContextAndHandler(metadata, undefined, true);
    const interceptor = new AuditLogInterceptor(reflector, prisma as never);

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test audit-log.interceptor.spec.ts`
Expected: FAIL — `Cannot find module './audit-log.interceptor'`.

- [ ] **Step 3: Implement the decorator and interceptor**

Create `apps/api/src/common/decorators/audit-log.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export interface AuditLogMetadata {
  action: string;
  extractTarget?: (result: unknown) => { targetType: string; targetId: string };
}

export const AUDIT_LOG_KEY = 'audit_log';
export const AuditLog = (action: string, extractTarget?: AuditLogMetadata['extractTarget']) =>
  SetMetadata(AUDIT_LOG_KEY, { action, extractTarget } as AuditLogMetadata);
```

Create `apps/api/src/common/interceptors/audit-log.interceptor.ts`:

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../decorators/audit-log.decorator';
import type { RequestWithAdmin } from '../../admin-identity/infrastructure/admin-auth.guard';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditLogMetadata | undefined>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();

    return next.handle().pipe(
      tap((result) => {
        const target = metadata.extractTarget?.(result) ?? {
          targetType: 'unknown',
          targetId: 'unknown',
        };
        void this.prisma.auditLog.create({
          data: {
            tenantId: request.admin!.tenantId,
            actorAdminId: request.admin!.id,
            action: metadata.action,
            targetType: target.targetType,
            targetId: target.targetId,
          },
        });
      }),
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test audit-log.interceptor.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common
git commit -m "feat(common): add AuditLog decorator and interceptor"
```

---

### Task 12: `packages/contracts` schemas for invite/accept/login

**Files:**
- Create: `packages/contracts/src/admin-auth.schema.ts`
- Create: `packages/contracts/src/admin-auth.schema.spec.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces: `inviteAdminUserSchema`/`InviteAdminUserDto` (`name`, `email`, `role: 'ORGANIZER'|'JUDGE'|'COMMITTEE'`), `acceptAdminInviteSchema`/`AcceptAdminInviteDto` (`password`, min 8 max 72), `loginAdminUserSchema`/`LoginAdminUserDto` (`email`, `password`), exported from `@fenac-platform/contracts`. Task 13's controller imports these.

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/admin-auth.schema.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  inviteAdminUserSchema,
  acceptAdminInviteSchema,
  loginAdminUserSchema,
} from './admin-auth.schema';

describe('inviteAdminUserSchema', () => {
  it('accepts a valid payload', () => {
    const result = inviteAdminUserSchema.safeParse({
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'JUDGE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid role', () => {
    const result = inviteAdminUserSchema.safeParse({
      name: 'Carlos Souza',
      email: 'carlos@example.com',
      role: 'SUPERADMIN',
    });
    expect(result.success).toBe(false);
  });
});

describe('acceptAdminInviteSchema', () => {
  it('accepts a valid password', () => {
    expect(acceptAdminInviteSchema.safeParse({ password: 'a-strong-password' }).success).toBe(
      true,
    );
  });

  it('rejects a short password', () => {
    expect(acceptAdminInviteSchema.safeParse({ password: 'short' }).success).toBe(false);
  });
});

describe('loginAdminUserSchema', () => {
  it('accepts a valid email/password pair', () => {
    expect(
      loginAdminUserSchema.safeParse({ email: 'carlos@example.com', password: 'x' }).success,
    ).toBe(true);
  });

  it('rejects a non-email identifier (admin login is email-only, unlike participants)', () => {
    expect(loginAdminUserSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/contracts && pnpm exec vitest run admin-auth.schema.spec.ts`
Expected: FAIL — `Cannot find module './admin-auth.schema'`.

- [ ] **Step 3: Implement the schemas**

Create `packages/contracts/src/admin-auth.schema.ts`:

```typescript
import { z } from 'zod';

export const ADMIN_ROLES = ['ORGANIZER', 'JUDGE', 'COMMITTEE'] as const;

export const inviteAdminUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  role: z.enum(ADMIN_ROLES),
});

export type InviteAdminUserDto = z.infer<typeof inviteAdminUserSchema>;

export const acceptAdminInviteSchema = z.object({
  password: z.string().min(8).max(72),
});

export type AcceptAdminInviteDto = z.infer<typeof acceptAdminInviteSchema>;

export const loginAdminUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginAdminUserDto = z.infer<typeof loginAdminUserSchema>;
```

Add to `packages/contracts/src/index.ts`:

```typescript
export {
  inviteAdminUserSchema,
  acceptAdminInviteSchema,
  loginAdminUserSchema,
  ADMIN_ROLES,
} from './admin-auth.schema.js';
export type {
  InviteAdminUserDto,
  AcceptAdminInviteDto,
  LoginAdminUserDto,
} from './admin-auth.schema.js';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/contracts && pnpm exec vitest run admin-auth.schema.spec.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): add admin invite/accept/login schemas"
```

---

### Task 13: `AdminAuthController` — invite, accept, login, refresh, me (e2e TDD)

**Files:**
- Create: `apps/api/src/admin-identity/infrastructure/admin-auth.controller.ts`
- Create: `apps/api/src/admin-identity/admin-identity.module.ts`
- Create: `apps/api/src/common/filters/admin-conflict.filter.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/admin-auth.e2e-spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-12 — `FindTenantBySlugUseCase` (existing, from `tenants` module), `InviteAdminUserUseCase`, `AcceptAdminInviteUseCase`, `AuthenticateAdminUserUseCase`, `AdminTokenService`, `AdminAuthGuard`, `RolesGuard`/`@Roles()`, `AuditLogInterceptor`/`@AuditLog()`, `AdminConflictError` (Task 8), `inviteAdminUserSchema`/`acceptAdminInviteSchema`/`loginAdminUserSchema` from `@fenac-platform/contracts`.
- Produces: `POST /tenants/:tenantSlug/admin/invites` (201, `ORGANIZER`-only, audit-logged) · `POST /tenants/:tenantSlug/admin/invites/:token/accept` (200, public) · `POST /tenants/:tenantSlug/admin/login` (200, sets `adminRefreshToken` httpOnly cookie, returns `{accessToken, admin}`) · `POST /tenants/:tenantSlug/admin/refresh` (200) · `GET /tenants/:tenantSlug/admin/me` (200, any authenticated admin, tenant-scoped like the participant module's `/me`).

- [ ] **Step 1: Write the failing e2e test**

Create `apps/api/test/admin-auth.e2e-spec.ts`:

```typescript
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

    // Seed the first ORGANIZER directly — bootstrapping the very first admin of a
    // tenant is out of scope for this plan (see Global Constraints); production
    // bootstrapping happens via the future legacy-data migration.
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
  });

  afterEach(async () => {
    await prisma.adminUser.deleteMany({ where: { email: newAdminEmail } });
  });

  afterAll(async () => {
    await prisma.adminUser.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
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

    const created = await prisma.adminUser.findUniqueOrThrow({ where: { id: invited.id } });
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
    expect((refreshResponse.body as RefreshResponseBody).accessToken).toBeDefined();

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

    const created = await prisma.adminUser.findFirstOrThrow({ where: { email: newAdminEmail } });
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/admin/invites/${created.inviteToken}/accept`)
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
      .send({ name: 'Someone Else', email: 'someone-else@example.com', password: 'x' })
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
});
```

- [ ] **Step 2: Run the e2e test to verify it fails**

Ensure MySQL is up: `docker compose up -d mysql`
Run: `cd apps/api && pnpm run test:e2e admin-auth.e2e-spec.ts`
Expected: FAIL — 404, no `/tenants/:tenantSlug/admin/*` routes registered yet.

- [ ] **Step 3: Add the `AdminConflictError` → 409 exception filter**

`InviteAdminUserUseCase` (Task 8) throws a plain `AdminConflictError` on a duplicate email — left uncaught, this becomes an unhandled 500 instead of a 409. Mirror the `tenants`/`identity` modules' existing precedent (`apps/api/src/common/filters/user-conflict.filter.ts`) exactly rather than inventing a new shape.

Create `apps/api/src/common/filters/admin-conflict.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { AdminConflictError } from '../../admin-identity/domain/admin-conflict.error';

@Catch(AdminConflictError)
export class AdminConflictExceptionFilter implements ExceptionFilter {
  catch(exception: AdminConflictError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(409).json({ statusCode: 409, message: exception.message });
  }
}
```

- [ ] **Step 4: Implement the controller**

Create `apps/api/src/admin-identity/infrastructure/admin-auth.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  inviteAdminUserSchema,
  acceptAdminInviteSchema,
  loginAdminUserSchema,
} from '@fenac-platform/contracts';
import type {
  InviteAdminUserDto,
  AcceptAdminInviteDto,
  LoginAdminUserDto,
} from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { AdminConflictExceptionFilter } from '../../common/filters/admin-conflict.filter';
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import { InviteAdminUserUseCase } from '../application/use-cases/invite-admin-user.use-case';
import { AcceptAdminInviteUseCase } from '../application/use-cases/accept-admin-invite.use-case';
import { AuthenticateAdminUserUseCase } from '../application/use-cases/authenticate-admin-user.use-case';
import { AdminTokenService } from './admin-token.service';
import { AdminAuthGuard, RequestWithAdmin } from './admin-auth.guard';
import {
  ADMIN_USERS_REPOSITORY,
  AdminUsersRepositoryPort,
} from '../application/ports/admin-users-repository.port';
import { InvalidAdminCredentialsError } from '../domain/invalid-admin-credentials.error';

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('tenants/:tenantSlug/admin')
@UseFilters(AdminConflictExceptionFilter)
export class AdminAuthController {
  constructor(
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly inviteAdminUser: InviteAdminUserUseCase,
    private readonly acceptAdminInvite: AcceptAdminInviteUseCase,
    private readonly authenticateAdminUser: AuthenticateAdminUserUseCase,
    private readonly tokenService: AdminTokenService,
    @Inject(ADMIN_USERS_REPOSITORY)
    private readonly adminUsersRepository: AdminUsersRepositoryPort,
  ) {}

  @Post('invites')
  @HttpCode(201)
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('invited_admin', (result: unknown) => ({
    targetType: 'AdminUser',
    targetId: (result as { id: string }).id,
  }))
  @UsePipes(new ZodValidationPipe(inviteAdminUserSchema))
  async invite(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: RequestWithAdmin,
    @Body() body: InviteAdminUserDto,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');
    if (tenant.id !== request.admin!.tenantId) throw new UnauthorizedException();

    const admin = await this.inviteAdminUser.execute({
      tenantId: tenant.id,
      name: body.name,
      email: body.email,
      role: body.role,
    });

    return { id: admin.id, name: admin.name, email: admin.email, status: admin.status };
  }

  @Post('invites/:token/accept')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(acceptAdminInviteSchema))
  async acceptInvite(@Param('token') token: string, @Body() body: AcceptAdminInviteDto) {
    const admin = await this.acceptAdminInvite.execute({ token, password: body.password });
    return { id: admin.id, name: admin.name, email: admin.email, status: admin.status };
  }

  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginAdminUserSchema))
  async login(
    @Param('tenantSlug') tenantSlug: string,
    @Body() body: LoginAdminUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    let admin;
    try {
      admin = await this.authenticateAdminUser.execute({
        tenantId: tenant.id,
        email: body.email,
        password: body.password,
      });
    } catch (error) {
      if (error instanceof InvalidAdminCredentialsError) {
        throw new UnauthorizedException('invalid credentials');
      }
      throw error;
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: admin.id,
      tenantId: tenant.id,
      role: admin.role,
    });
    const refreshToken = this.tokenService.signRefreshToken({
      sub: admin.id,
      tenantId: tenant.id,
      role: admin.role,
    });

    response.cookie('adminRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: `/tenants/${tenantSlug}/admin`,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    return {
      accessToken,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    const cookies = request.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.adminRefreshToken;
    if (!refreshToken) throw new UnauthorizedException();

    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      if (payload.tenantId !== tenant.id) throw new UnauthorizedException();

      const accessToken = this.tokenService.signAccessToken(payload);
      return { accessToken };
    } catch {
      throw new UnauthorizedException();
    }
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  async me(@Param('tenantSlug') tenantSlug: string, @Req() request: RequestWithAdmin) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');
    if (tenant.id !== request.admin!.tenantId) throw new UnauthorizedException();

    const admin = await this.adminUsersRepository.findById(tenant.id, request.admin!.id);
    if (!admin) throw new NotFoundException();

    return { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
  }
}
```

- [ ] **Step 5: Wire the module**

Create `apps/api/src/admin-identity/admin-identity.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminAuthController } from './infrastructure/admin-auth.controller';
import { AdminTokenService } from './infrastructure/admin-token.service';
import { AdminAuthGuard } from './infrastructure/admin-auth.guard';
import { PrismaAdminUsersRepository } from './infrastructure/prisma-admin-users.repository';
import { ADMIN_USERS_REPOSITORY } from './application/ports/admin-users-repository.port';
import { InviteAdminUserUseCase } from './application/use-cases/invite-admin-user.use-case';
import { AcceptAdminInviteUseCase } from './application/use-cases/accept-admin-invite.use-case';
import { AuthenticateAdminUserUseCase } from './application/use-cases/authenticate-admin-user.use-case';
import { BcryptPasswordHasher } from '../identity/infrastructure/bcrypt-password-hasher';
import { PASSWORD_HASHER } from '../identity/application/ports/password-hasher.port';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    TenantsModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.ADMIN_JWT_SECRET;
        if (!secret) {
          throw new Error('ADMIN_JWT_SECRET is not set');
        }
        return { secret };
      },
    }),
  ],
  controllers: [AdminAuthController],
  providers: [
    InviteAdminUserUseCase,
    AcceptAdminInviteUseCase,
    AuthenticateAdminUserUseCase,
    AdminTokenService,
    AdminAuthGuard,
    RolesGuard,
    AuditLogInterceptor,
    { provide: ADMIN_USERS_REPOSITORY, useClass: PrismaAdminUsersRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
  exports: [AdminAuthGuard, AdminTokenService],
})
export class AdminIdentityModule {}
```

**Note for the implementer:** `@UseGuards(AdminAuthGuard, RolesGuard)` and `@UseInterceptors(AuditLogInterceptor)` on the `invite` handler reference these classes directly — NestJS only resolves their constructor dependencies (`Reflector`, `PrismaService`) correctly if the class is registered as a provider in a reachable module, which is why `RolesGuard` and `AuditLogInterceptor` are in the `providers` array above even though nothing directly injects them elsewhere. `Reflector` itself needs no explicit registration — it's a built-in Nest core provider available everywhere. `PrismaService` needs no explicit import either — it's exported by the `@Global()` `PrismaModule` from the bootstrap plan.

Open `apps/api/src/app.module.ts` and add `AdminIdentityModule` to its `imports` array, importing from `./admin-identity/admin-identity.module`.

- [ ] **Step 6: Run the e2e test to verify it passes**

Run: `cd apps/api && pnpm run test:e2e admin-auth.e2e-spec.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 7: Run the full test suite**

Run: `cd apps/api && pnpm run test && pnpm run test:integration && pnpm run test:e2e`
Expected: all PASS.
Run: `cd apps/api && pnpm run build`
Expected: exit 0, no TS1272 or other errors — this project has hit type-only-import build errors multiple times; do not skip this check.
Run: `cd apps/api && pnpm run lint`
Expected: 0 errors (pre-existing warnings on `app.getHttpServer()` calls are tolerated; no new errors).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(admin-identity): expose AdminAuthController (invite/accept/login/refresh/me)"
```

---

## Self-Review Notes

- **Spec coverage**: §3's admin auth requirements (invite-only, email+password, no 2FA) → Tasks 8-10, 13. RBAC with `ORGANIZER`/`JUDGE`/`COMMITTEE` → Tasks 3, 7. Audit logging for sensitive admin actions → Task 11, with a real consumer in Task 13 (the invite endpoint) — the interceptor is intentionally generic so a later plan's user-management actions (email/CPF/password overwrite, decided in the original brainstorming) can reuse it via the same `@AuditLog()` decorator. §2's automatic tenant-scoping mechanism → Task 2 (`TenantScopedRepository`), consumed by Task 4; the existing `identity` module's `PrismaUsersRepository` is deliberately NOT retrofitted (YAGNI — noted as a forward cleanup, not bundled here). The two architectural decisions flagged when this plan was requested (dedicated admin JWT module vs. shared service; whether to introduce the tenant-scoping base class now) are both resolved explicitly in the Architecture section and Global Constraints above, not left as open questions for the implementer.
- **Type consistency checked**: `AdminUsersRepositoryPort.save/findByEmail/findByInviteToken/findById` (Task 4) match every call site in Tasks 8-10, 13. `AdminTokenService.signAccessToken/signRefreshToken/verifyAccessToken/verifyRefreshToken` (Task 5) match usage in Tasks 6, 13. `request.admin` shape (`{id, tenantId, role}`, Task 6) matches what Task 7's `RolesGuard`, Task 11's `AuditLogInterceptor`, and Task 13's controller all read. `PasswordHasherPort`/`PASSWORD_HASHER` and `InviteAdminUserInput`/`AdminUserProps` names match their original definitions in Tasks 3-4 and the existing `identity` module throughout.
- **No placeholders**: every step shows full file contents or an exact runnable command with expected output; no "add error handling" or "similar to Task N" shortcuts.
