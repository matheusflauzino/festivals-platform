# Participant Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build participant (candidate) registration and authentication for the public portal — email-or-CPF login, JWT access + refresh tokens, and a protected `/me` endpoint — scoped per tenant, following the same clean-architecture pattern the `tenants` module already established.

**Architecture:** A new `apps/api/src/identity` module, layered the same way as `tenants` (domain → application → infrastructure). `User` (participant) is tenant-scoped: email/CPF uniqueness is per-tenant, not global, since each tenant's public portal has its own candidate base. Auth endpoints are nested under the tenant's slug (`/tenants/:tenantSlug/auth/...`), reusing `FindTenantBySlugUseCase` from the existing `tenants` module to resolve which tenant a request belongs to — there is no subdomain/URL-rewrite middleware yet (that's frontend work for a later plan), so the slug is an explicit route param for now.

**Tech Stack:** NestJS, `@nestjs/jwt`, `bcryptjs` (pure JS — no native compilation, avoiding the class of Docker/Alpine build surprises hit repeatedly in the bootstrap plan; also required for forward-compatibility with legacy `$2y$` bcrypt hashes per the data-migration spec), `cookie-parser`, Prisma/MySQL, Jest.

**Spec:** `docs/specs/2026-09-15-fenac-platform-architecture-design.md` (§2 Clean Architecture, §3 Auth, §6 domain model — `User` entity).

## Global Constraints

- Clean Architecture per module: `domain` (zero NestJS/Prisma dependency) → `application` (use cases + ports; `@Injectable`/`@Inject` from `@nestjs/common` are an accepted pragmatic convention here, established in the `tenants` module — only `domain` stays framework-free) → `infrastructure` (Prisma repositories, guards, controllers).
- TDD mandatory: failing test before implementation, every task.
- Always install packages with the `@latest` tag, then verify the actual installed behavior empirically (read the generated lockfile version, run the code) rather than trusting training-data assumptions about what a package version does — the bootstrap plan hit several real breaking changes this way.
- Multi-tenancy: `User` carries `tenantId`; email and CPF uniqueness are enforced **per tenant** (`@@unique([tenantId, email])`, `@@unique([tenantId, cpf])`), not globally.
- Participant auth: login by email OR CPF + password, JWT access token (short-lived) + refresh token (httpOnly cookie), no 2FA.
- Passwords hashed with a bcrypt-compatible algorithm — must be able to verify hashes with the `$2y$` prefix (PHP/Laravel's bcrypt variant) for the future legacy-data migration, not just hashes this system generates itself.
- Follow the existing `tenants` module's patterns exactly: `Tenant.create`/`Tenant.restore` static-factory style entities, `XxxRepositoryPort` interfaces with a `Symbol` DI token, `InMemoryXxxRepository` test doubles, Prisma repositories reconstructing entities via `.restore()`.

---

### Task 1: Add `findById` to `TenantsRepositoryPort`

**Files:**
- Modify: `apps/api/src/tenants/application/ports/tenants-repository.port.ts`
- Modify: `apps/api/src/tenants/infrastructure/prisma-tenants.repository.ts`
- Modify: `apps/api/src/tenants/infrastructure/in-memory-tenants.repository.ts`
- Test: `apps/api/src/tenants/infrastructure/prisma-tenants.repository.integration-spec.ts`

**Interfaces:**
- Produces: `TenantsRepositoryPort.findById(id: string): Promise<Tenant | null>`. Later tasks in this plan use this to resolve a `Tenant` from the `tenantId` embedded in a JWT claim.

- [ ] **Step 1: Write the failing integration test**

Add to `apps/api/src/tenants/infrastructure/prisma-tenants.repository.integration-spec.ts` (inside the existing `describe` block, alongside the existing tests):

```typescript
  it('finds a tenant back by id', async () => {
    const tenant = Tenant.create({
      name: 'Find By Id Tenant',
      document: 'CD123456789012',
      slug: 'find-by-id-tenant',
    });
    await repository.save(tenant);

    const found = await repository.findById(tenant.id);

    expect(found).not.toBeNull();
    expect(found?.slug).toBe('find-by-id-tenant');
  });
```

Also change the `afterEach` cleanup to delete by both slugs used in the file (add `'find-by-id-tenant'` alongside `testSlug` in the `where` clause, e.g. `where: { slug: { in: [testSlug, 'find-by-id-tenant'] } }`).

- [ ] **Step 2: Run the test to verify it fails**

Ensure MySQL is up: `docker compose up -d mysql`
Run: `cd apps/api && pnpm run test:integration`
Expected: FAIL — `repository.findById is not a function`.

- [ ] **Step 3: Add `findById` to the port and both implementations**

In `apps/api/src/tenants/application/ports/tenants-repository.port.ts`, add to the interface:

```typescript
  findById(id: string): Promise<Tenant | null>;
```

In `apps/api/src/tenants/infrastructure/prisma-tenants.repository.ts`, add a method alongside `findBySlug`:

```typescript
  async findById(id: string): Promise<Tenant | null> {
    const row = await this.prisma.tenant.findUnique({ where: { id } });
    if (!row) return null;

    return Tenant.restore({
      id: row.id,
      name: row.name,
      document: row.document,
      slug: row.slug,
      status: row.status,
      createdAt: row.createdAt,
    });
  }
```

In `apps/api/src/tenants/infrastructure/in-memory-tenants.repository.ts`, add:

```typescript
  async findById(id: string): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.id === id) return tenant;
    }
    return null;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test:integration`
Expected: PASS (3 tests total in this file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tenants
git commit -m "feat(tenants): add findById to TenantsRepositoryPort"
```

---

### Task 2: `User` domain entity (TDD)

**Files:**
- Create: `apps/api/src/identity/domain/user.entity.ts`
- Create: `apps/api/src/identity/domain/user.entity.spec.ts`

**Interfaces:**
- Produces: `User.create({ tenantId, name, email, cpf, passwordHash }): User` (throws on invalid email/CPF format), `User.restore(props): User`, getters `.id/.tenantId/.name/.email/.cpf/.passwordHash/.createdAt`. Task 5 (`UsersRepositoryPort`) and Task 6 (`RegisterUserUseCase`) depend on these exact names.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/identity/domain/user.entity.spec.ts`:

```typescript
import { User } from './user.entity';

describe('User', () => {
  const validInput = {
    tenantId: 'tenant-1',
    name: 'Ana Silva',
    email: 'ana@example.com',
    cpf: '12345678901',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
  };

  it('creates a user with the given fields', () => {
    const user = User.create(validInput);

    expect(user.id).toBeDefined();
    expect(user.tenantId).toBe('tenant-1');
    expect(user.email).toBe('ana@example.com');
    expect(user.cpf).toBe('12345678901');
  });

  it('rejects an invalid email', () => {
    expect(() => User.create({ ...validInput, email: 'not-an-email' })).toThrow(
      'invalid email',
    );
  });

  it('rejects a CPF that is not exactly 11 digits', () => {
    expect(() => User.create({ ...validInput, cpf: '123' })).toThrow(
      'cpf must be 11 digits',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test user.entity.spec.ts`
Expected: FAIL — `Cannot find module './user.entity'`.

- [ ] **Step 3: Implement the `User` domain entity**

Create `apps/api/src/identity/domain/user.entity.ts`:

```typescript
import { randomUUID } from 'crypto';

export interface UserProps {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  cpf: string;
  passwordHash: string;
  createdAt: Date;
}

export interface CreateUserInput {
  tenantId: string;
  name: string;
  email: string;
  cpf: string;
  passwordHash: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_PATTERN = /^\d{11}$/;

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(input: CreateUserInput): User {
    if (!EMAIL_PATTERN.test(input.email)) {
      throw new Error('invalid email');
    }
    if (!CPF_PATTERN.test(input.cpf)) {
      throw new Error('cpf must be 11 digits');
    }

    return new User({
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      cpf: input.cpf,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    });
  }

  static restore(props: UserProps): User {
    return new User(props);
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

  get cpf(): string {
    return this.props.cpf;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test user.entity.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/identity
git commit -m "feat(identity): add User domain entity"
```

---

### Task 3: `PasswordHasherPort` + `BcryptPasswordHasher` (TDD)

**Files:**
- Create: `apps/api/src/identity/application/ports/password-hasher.port.ts`
- Create: `apps/api/src/identity/infrastructure/bcrypt-password-hasher.ts`
- Create: `apps/api/src/identity/infrastructure/bcrypt-password-hasher.spec.ts`

**Interfaces:**
- Produces: `PasswordHasherPort.hash(plain: string): Promise<string>`, `.compare(plain: string, hash: string): Promise<boolean>`, `PASSWORD_HASHER` DI token, `BcryptPasswordHasher implements PasswordHasherPort`. Task 6/7's use cases depend on this port; Task 4/5's repositories do not (they store the already-hashed string).

- [ ] **Step 1: Install bcryptjs**

Run: `cd apps/api && pnpm add bcryptjs@latest && pnpm add -D @types/bcryptjs@latest`

- [ ] **Step 2: Define the port**

Create `apps/api/src/identity/application/ports/password-hasher.port.ts`:

```typescript
export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
```

- [ ] **Step 3: Write the failing test**

Create `apps/api/src/identity/infrastructure/bcrypt-password-hasher.spec.ts`:

```typescript
import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes a password and verifies it matches', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.compare('correct horse battery staple', hash)).resolves.toBe(
      true,
    );
  });

  it('rejects the wrong password', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.compare('wrong password', hash)).resolves.toBe(false);
  });

  it('verifies a legacy $2y$ hash (PHP/Laravel bcrypt variant)', async () => {
    // Generated by PHP's password_hash('secret123', PASSWORD_BCRYPT)
    const legacyHash =
      '$2y$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    await expect(hasher.compare('secret123', legacyHash)).resolves.toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test bcrypt-password-hasher.spec.ts`
Expected: FAIL — `Cannot find module './bcrypt-password-hasher'`.

- [ ] **Step 5: Implement `BcryptPasswordHasher`**

Create `apps/api/src/identity/infrastructure/bcrypt-password-hasher.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasherPort } from '../application/ports/password-hasher.port';

const SALT_ROUNDS = 10;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test bcrypt-password-hasher.spec.ts`
Expected: PASS (all 3 cases — including the legacy `$2y$` hash comparison; if this specific case fails, check `bcryptjs`'s changelog for `$2y$` handling before changing anything else, since forward-compatibility with legacy hashes is a hard requirement here, not a nice-to-have).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/identity apps/api/package.json apps/api/../../pnpm-lock.yaml
git commit -m "feat(identity): add PasswordHasherPort and BcryptPasswordHasher"
```

---

### Task 4: Prisma `User` model + `UsersRepositoryPort` + `PrismaUsersRepository` (TDD)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/identity/application/ports/users-repository.port.ts`
- Create: `apps/api/src/identity/infrastructure/prisma-users.repository.ts`
- Create: `apps/api/src/identity/infrastructure/in-memory-users.repository.ts`
- Test: `apps/api/src/identity/infrastructure/prisma-users.repository.integration-spec.ts`

**Interfaces:**
- Consumes: `User` (Task 2), `PrismaService` (existing, `apps/api/src/prisma/prisma.service.ts`).
- Produces: `UsersRepositoryPort.save(user: User): Promise<void>`, `.findByEmailOrCpf(tenantId: string, identifier: string): Promise<User | null>`, `.findById(id: string): Promise<User | null>`, `USERS_REPOSITORY` DI token, `PrismaUsersRepository implements UsersRepositoryPort`, `InMemoryUsersRepository implements UsersRepositoryPort`. Task 6/7's use cases and Task 9's guard depend on these exact names.

- [ ] **Step 1: Add the `User` model to the Prisma schema**

Add to `apps/api/prisma/schema.prisma` (after the existing `Tenant` model):

```prisma
model User {
  id           String   @id @default(uuid())
  tenantId     String   @map("tenant_id")
  name         String
  email        String
  cpf          String
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([tenantId, email])
  @@unique([tenantId, cpf])
  @@map("users")
}
```

- [ ] **Step 2: Run the migration**

Ensure MySQL is up: `docker compose up -d mysql`
Run: `cd apps/api && pnpm exec prisma migrate dev --name add_users`
Expected: creates a new migration under `apps/api/prisma/migrations/`, applies it, regenerates the Prisma Client.

- [ ] **Step 3: Define the port**

Create `apps/api/src/identity/application/ports/users-repository.port.ts`:

```typescript
import { User } from '../../domain/user.entity';

export interface UsersRepositoryPort {
  save(user: User): Promise<void>;
  findByEmailOrCpf(tenantId: string, identifier: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
```

- [ ] **Step 4: Write the failing integration test**

Create `apps/api/src/identity/infrastructure/prisma-users.repository.integration-spec.ts`:

```typescript
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
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test:integration prisma-users.repository.integration-spec.ts`
Expected: FAIL — `Cannot find module './prisma-users.repository'`.

- [ ] **Step 6: Implement `PrismaUsersRepository`**

Create `apps/api/src/identity/infrastructure/prisma-users.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../domain/user.entity';
import { UsersRepositoryPort } from '../application/ports/users-repository.port';

@Injectable()
export class PrismaUsersRepository implements UsersRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt,
      },
      update: {
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        passwordHash: user.passwordHash,
      },
    });
  }

  async findByEmailOrCpf(tenantId: string, identifier: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: {
        tenantId,
        OR: [{ email: identifier }, { cpf: identifier }],
      },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) return null;
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    cpf: string;
    passwordHash: string;
    createdAt: Date;
  }): User {
    return User.restore({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      email: row.email,
      cpf: row.cpf,
      passwordHash: row.passwordHash,
      createdAt: row.createdAt,
    });
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test:integration prisma-users.repository.integration-spec.ts`
Expected: PASS (both cases).

- [ ] **Step 8: Add the in-memory test double**

Create `apps/api/src/identity/infrastructure/in-memory-users.repository.ts`:

```typescript
import { User } from '../domain/user.entity';
import { UsersRepositoryPort } from '../application/ports/users-repository.port';

export class InMemoryUsersRepository implements UsersRepositoryPort {
  private readonly users = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async findByEmailOrCpf(tenantId: string, identifier: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.tenantId === tenantId && (user.email === identifier || user.cpf === identifier)) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma apps/api/src/identity
git commit -m "feat(identity): add User Prisma model and repository"
```

---

### Task 5: `RegisterUserUseCase` (TDD, in-memory)

**Files:**
- Create: `apps/api/src/identity/application/use-cases/register-user.use-case.ts`
- Create: `apps/api/src/identity/application/use-cases/register-user.use-case.spec.ts`

**Interfaces:**
- Consumes: `User` (Task 2), `UsersRepositoryPort`/`USERS_REPOSITORY` (Task 4), `PasswordHasherPort`/`PASSWORD_HASHER` (Task 3).
- Produces: `RegisterUserUseCase.execute(input: { tenantId, name, email, cpf, password }): Promise<User>` (throws `'email or cpf already registered'` on conflict). Task 8 (HTTP controller) depends on this signature.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/identity/application/use-cases/register-user.use-case.spec.ts`:

```typescript
import { RegisterUserUseCase } from './register-user.use-case';
import { InMemoryUsersRepository } from '../../infrastructure/in-memory-users.repository';
import { PasswordHasherPort } from '../ports/password-hasher.port';

class FakePasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

describe('RegisterUserUseCase', () => {
  it('registers a user with a hashed password', async () => {
    const repository = new InMemoryUsersRepository();
    const useCase = new RegisterUserUseCase(repository, new FakePasswordHasher());

    const user = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'plaintext-password',
    });

    expect(user.email).toBe('ana@example.com');
    expect(user.passwordHash).toBe('hashed:plaintext-password');
    await expect(
      repository.findByEmailOrCpf('tenant-1', 'ana@example.com'),
    ).resolves.toEqual(user);
  });

  it('rejects a duplicate email within the same tenant', async () => {
    const repository = new InMemoryUsersRepository();
    const useCase = new RegisterUserUseCase(repository, new FakePasswordHasher());

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'pw',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        name: 'Outra Pessoa',
        email: 'ana@example.com',
        cpf: '10987654321',
        password: 'pw2',
      }),
    ).rejects.toThrow('email or cpf already registered');
  });

  it('allows the same email in a different tenant', async () => {
    const repository = new InMemoryUsersRepository();
    const useCase = new RegisterUserUseCase(repository, new FakePasswordHasher());

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'pw',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-2',
        name: 'Ana Silva',
        email: 'ana@example.com',
        cpf: '12345678901',
        password: 'pw',
      }),
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test register-user.use-case.spec.ts`
Expected: FAIL — `Cannot find module './register-user.use-case'`.

- [ ] **Step 3: Implement `RegisterUserUseCase`**

Create `apps/api/src/identity/application/use-cases/register-user.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/user.entity';
import { USERS_REPOSITORY, UsersRepositoryPort } from '../ports/users-repository.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../ports/password-hasher.port';

export interface RegisterUserInput {
  tenantId: string;
  name: string;
  email: string;
  cpf: string;
  password: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    const existingByEmail = await this.usersRepository.findByEmailOrCpf(
      input.tenantId,
      input.email,
    );
    const existingByCpf = await this.usersRepository.findByEmailOrCpf(
      input.tenantId,
      input.cpf,
    );
    if (existingByEmail || existingByCpf) {
      throw new Error('email or cpf already registered');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = User.create({
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      cpf: input.cpf,
      passwordHash,
    });

    await this.usersRepository.save(user);
    return user;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test register-user.use-case.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/identity
git commit -m "feat(identity): add RegisterUserUseCase"
```

---

### Task 6: `AuthenticateUserUseCase` (TDD, in-memory)

**Files:**
- Create: `apps/api/src/identity/application/use-cases/authenticate-user.use-case.ts`
- Create: `apps/api/src/identity/application/use-cases/authenticate-user.use-case.spec.ts`

**Interfaces:**
- Consumes: `User`, `UsersRepositoryPort`/`USERS_REPOSITORY`, `PasswordHasherPort`/`PASSWORD_HASHER`.
- Produces: `AuthenticateUserUseCase.execute(input: { tenantId, identifier, password }): Promise<User>` (throws `'invalid credentials'` on any mismatch — same message for unknown user and wrong password, to avoid leaking which one it was). Task 8 depends on this signature.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/identity/application/use-cases/authenticate-user.use-case.spec.ts`:

```typescript
import { AuthenticateUserUseCase } from './authenticate-user.use-case';
import { RegisterUserUseCase } from './register-user.use-case';
import { InMemoryUsersRepository } from '../../infrastructure/in-memory-users.repository';
import { PasswordHasherPort } from '../ports/password-hasher.port';

class FakePasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

describe('AuthenticateUserUseCase', () => {
  it('authenticates by email with the correct password', async () => {
    const repository = new InMemoryUsersRepository();
    const hasher = new FakePasswordHasher();
    await new RegisterUserUseCase(repository, hasher).execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'correct-password',
    });

    const useCase = new AuthenticateUserUseCase(repository, hasher);
    const user = await useCase.execute({
      tenantId: 'tenant-1',
      identifier: 'ana@example.com',
      password: 'correct-password',
    });

    expect(user.email).toBe('ana@example.com');
  });

  it('authenticates by cpf with the correct password', async () => {
    const repository = new InMemoryUsersRepository();
    const hasher = new FakePasswordHasher();
    await new RegisterUserUseCase(repository, hasher).execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'correct-password',
    });

    const useCase = new AuthenticateUserUseCase(repository, hasher);
    const user = await useCase.execute({
      tenantId: 'tenant-1',
      identifier: '12345678901',
      password: 'correct-password',
    });

    expect(user.cpf).toBe('12345678901');
  });

  it('rejects the wrong password', async () => {
    const repository = new InMemoryUsersRepository();
    const hasher = new FakePasswordHasher();
    await new RegisterUserUseCase(repository, hasher).execute({
      tenantId: 'tenant-1',
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'correct-password',
    });

    const useCase = new AuthenticateUserUseCase(repository, hasher);
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        identifier: 'ana@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('invalid credentials');
  });

  it('rejects an unknown identifier', async () => {
    const repository = new InMemoryUsersRepository();
    const hasher = new FakePasswordHasher();
    const useCase = new AuthenticateUserUseCase(repository, hasher);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        identifier: 'nobody@example.com',
        password: 'anything',
      }),
    ).rejects.toThrow('invalid credentials');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test authenticate-user.use-case.spec.ts`
Expected: FAIL — `Cannot find module './authenticate-user.use-case'`.

- [ ] **Step 3: Implement `AuthenticateUserUseCase`**

Create `apps/api/src/identity/application/use-cases/authenticate-user.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/user.entity';
import { USERS_REPOSITORY, UsersRepositoryPort } from '../ports/users-repository.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../ports/password-hasher.port';

export interface AuthenticateUserInput {
  tenantId: string;
  identifier: string;
  password: string;
}

@Injectable()
export class AuthenticateUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<User> {
    const user = await this.usersRepository.findByEmailOrCpf(
      input.tenantId,
      input.identifier,
    );
    if (!user) {
      throw new Error('invalid credentials');
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new Error('invalid credentials');
    }

    return user;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test authenticate-user.use-case.spec.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/identity
git commit -m "feat(identity): add AuthenticateUserUseCase"
```

---

### Task 7: JWT token service (TDD)

**Files:**
- Create: `apps/api/src/identity/infrastructure/participant-token.service.ts`
- Create: `apps/api/src/identity/infrastructure/participant-token.service.spec.ts`
- Modify: `.env.example`
- Modify: `apps/api/.env` (not committed — gitignored; update your local copy the same way)

**Interfaces:**
- Produces: `ParticipantTokenService.signAccessToken(payload: { sub: string; tenantId: string }): string`, `.signRefreshToken(payload: { sub: string; tenantId: string }): string`, `.verify(token: string): { sub: string; tenantId: string }` (throws on invalid/expired token). Task 9 (guard) and Task 10 (controller) depend on these exact names.

- [ ] **Step 1: Install `@nestjs/jwt`**

Run: `cd apps/api && pnpm add @nestjs/jwt@latest`

- [ ] **Step 2: Add `JWT_SECRET` to env files**

Add to `.env.example` (repo root):

```
JWT_SECRET="dev-only-change-me"
```

Add the same line (with any value) to your local `.env` and `apps/api/.env`.

- [ ] **Step 3: Write the failing test**

Create `apps/api/src/identity/infrastructure/participant-token.service.spec.ts`:

```typescript
import { JwtService } from '@nestjs/jwt';
import { ParticipantTokenService } from './participant-token.service';

describe('ParticipantTokenService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const service = new ParticipantTokenService(jwtService);

  it('signs and verifies an access token', () => {
    const token = service.signAccessToken({ sub: 'user-1', tenantId: 'tenant-1' });
    const payload = service.verify(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.tenantId).toBe('tenant-1');
  });

  it('signs and verifies a refresh token', () => {
    const token = service.signRefreshToken({ sub: 'user-1', tenantId: 'tenant-1' });
    const payload = service.verify(token);

    expect(payload.sub).toBe('user-1');
  });

  it('rejects a token signed with a different secret', () => {
    const otherService = new ParticipantTokenService(
      new JwtService({ secret: 'different-secret' }),
    );
    const token = otherService.signAccessToken({ sub: 'user-1', tenantId: 'tenant-1' });

    expect(() => service.verify(token)).toThrow();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test participant-token.service.spec.ts`
Expected: FAIL — `Cannot find module './participant-token.service'`.

- [ ] **Step 5: Implement `ParticipantTokenService`**

Create `apps/api/src/identity/infrastructure/participant-token.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface ParticipantTokenPayload {
  sub: string;
  tenantId: string;
}

@Injectable()
export class ParticipantTokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: ParticipantTokenPayload): string {
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  signRefreshToken(payload: ParticipantTokenPayload): string {
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  verify(token: string): ParticipantTokenPayload {
    return this.jwtService.verify<ParticipantTokenPayload>(token);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test participant-token.service.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/identity apps/api/package.json .env.example ../../pnpm-lock.yaml
git commit -m "feat(identity): add ParticipantTokenService (JWT sign/verify)"
```

---

### Task 8: `ParticipantAuthGuard` (TDD)

**Files:**
- Create: `apps/api/src/identity/infrastructure/participant-auth.guard.ts`
- Create: `apps/api/src/identity/infrastructure/participant-auth.guard.spec.ts`

**Interfaces:**
- Consumes: `ParticipantTokenService` (Task 7).
- Produces: `ParticipantAuthGuard` (NestJS `CanActivate`), attaches `request.participant = { id: string; tenantId: string }` on success, throws `UnauthorizedException` otherwise. Task 10 (controller's `/me` endpoint) depends on `request.participant`'s exact shape.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/identity/infrastructure/participant-auth.guard.spec.ts`:

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ParticipantTokenService } from './participant-token.service';
import { ParticipantAuthGuard } from './participant-auth.guard';

function makeContext(authHeader?: string): ExecutionContext {
  const request: { headers: Record<string, string>; participant?: unknown } = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ParticipantAuthGuard', () => {
  const tokenService = new ParticipantTokenService(new JwtService({ secret: 'test-secret' }));
  const guard = new ParticipantAuthGuard(tokenService);

  it('allows a request with a valid bearer token and attaches request.participant', () => {
    const token = tokenService.signAccessToken({ sub: 'user-1', tenantId: 'tenant-1' });
    const context = makeContext(`Bearer ${token}`);

    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.participant).toEqual({ id: 'user-1', tenantId: 'tenant-1' });
  });

  it('rejects a request with no authorization header', () => {
    const context = makeContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a request with an invalid token', () => {
    const context = makeContext('Bearer not-a-real-token');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test participant-auth.guard.spec.ts`
Expected: FAIL — `Cannot find module './participant-auth.guard'`.

- [ ] **Step 3: Implement `ParticipantAuthGuard`**

Create `apps/api/src/identity/infrastructure/participant-auth.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ParticipantTokenService } from './participant-token.service';

interface RequestWithParticipant extends Request {
  participant?: { id: string; tenantId: string };
}

@Injectable()
export class ParticipantAuthGuard implements CanActivate {
  constructor(private readonly tokenService: ParticipantTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithParticipant>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = this.tokenService.verify(token);
      request.participant = { id: payload.sub, tenantId: payload.tenantId };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test participant-auth.guard.spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/identity
git commit -m "feat(identity): add ParticipantAuthGuard"
```

---

### Task 9: `packages/contracts` schemas for register/login

**Files:**
- Create: `packages/contracts/src/participant-auth.schema.ts`
- Create: `packages/contracts/src/participant-auth.schema.spec.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces: `registerParticipantSchema` (Zod), `RegisterParticipantDto` (inferred type), `loginParticipantSchema`, `LoginParticipantDto`, exported from `@fenac-platform/contracts`. Task 10's controller imports these.

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/participant-auth.schema.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { registerParticipantSchema, loginParticipantSchema } from './participant-auth.schema';

describe('registerParticipantSchema', () => {
  it('accepts a valid payload', () => {
    const result = registerParticipantSchema.safeParse({
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'a-strong-password',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a cpf that is not 11 digits', () => {
    const result = registerParticipantSchema.safeParse({
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '123',
      password: 'a-strong-password',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerParticipantSchema.safeParse({
      name: 'Ana Silva',
      email: 'ana@example.com',
      cpf: '12345678901',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginParticipantSchema', () => {
  it('accepts an email or cpf as the identifier', () => {
    expect(
      loginParticipantSchema.safeParse({ identifier: 'ana@example.com', password: 'x' })
        .success,
    ).toBe(true);
    expect(
      loginParticipantSchema.safeParse({ identifier: '12345678901', password: 'x' })
        .success,
    ).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = loginParticipantSchema.safeParse({
      identifier: 'ana@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/contracts && pnpm exec vitest run participant-auth.schema.spec.ts`
Expected: FAIL — `Cannot find module './participant-auth.schema'`.

- [ ] **Step 3: Implement the schemas**

Create `packages/contracts/src/participant-auth.schema.ts`:

```typescript
import { z } from 'zod';

export const registerParticipantSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  cpf: z.string().regex(/^\d{11}$/, 'cpf must be exactly 11 digits'),
  password: z.string().min(8).max(72),
});

export type RegisterParticipantDto = z.infer<typeof registerParticipantSchema>;

export const loginParticipantSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export type LoginParticipantDto = z.infer<typeof loginParticipantSchema>;
```

Add to `packages/contracts/src/index.ts`:

```typescript
export { registerParticipantSchema, loginParticipantSchema } from './participant-auth.schema';
export type { RegisterParticipantDto, LoginParticipantDto } from './participant-auth.schema';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/contracts && pnpm exec vitest run participant-auth.schema.spec.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): add participant register/login schemas"
```

---

### Task 10: `AuthController` — register, login, refresh (e2e TDD)

**Files:**
- Create: `apps/api/src/identity/infrastructure/auth.controller.ts`
- Create: `apps/api/src/identity/identity.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `RegisterUserUseCase`, `AuthenticateUserUseCase` (Tasks 5-6), `ParticipantTokenService` (Task 7), `registerParticipantSchema`/`loginParticipantSchema` from `@fenac-platform/contracts` (Task 9), `FindTenantBySlugUseCase` (existing, `apps/api/src/tenants/application/use-cases/find-tenant-by-slug.use-case.ts`).
- Produces: `POST /tenants/:tenantSlug/auth/register` (201), `POST /tenants/:tenantSlug/auth/login` (200, sets `refreshToken` httpOnly cookie, returns `{ accessToken, user }` in body), `POST /tenants/:tenantSlug/auth/refresh` (200, reads the cookie, returns a new `{ accessToken }`).

- [ ] **Step 1: Install `cookie-parser`**

Run: `cd apps/api && pnpm add cookie-parser@latest && pnpm add -D @types/cookie-parser@latest`

- [ ] **Step 2: Wire `cookie-parser` into the app**

Modify `apps/api/src/main.ts` — add near the top of the bootstrap function, before `app.listen(...)`:

```typescript
import cookieParser from 'cookie-parser';
// ...inside bootstrap(), after `const app = await NestFactory.create(AppModule);`:
app.use(cookieParser());
```

- [ ] **Step 3: Write the failing e2e test**

Create `apps/api/test/auth.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantSlug = 'auth-e2e-tenant';
  const userEmail = 'auth-e2e-user@example.com';

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
    await prisma.user.deleteMany({ where: { email: userEmail } });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: tenantSlug } });
    await app.close();
  });

  it('registers, logs in, and refreshes an access token', async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/register`)
      .send({ name: 'Ana Silva', email: userEmail, cpf: '12345678901', password: 'a-strong-password' })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/login`)
      .send({ identifier: userEmail, password: 'a-strong-password' })
      .expect(200);

    expect(loginResponse.body.accessToken).toBeDefined();
    expect(loginResponse.body.user.email).toBe(userEmail);
    const setCookieHeader = loginResponse.headers['set-cookie'];
    expect(setCookieHeader[0]).toContain('refreshToken=');

    const refreshResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/refresh`)
      .set('Cookie', setCookieHeader)
      .expect(200);

    expect(refreshResponse.body.accessToken).toBeDefined();
  });

  it('returns 401 for a login with the wrong password', async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/register`)
      .send({ name: 'Ana Silva', email: userEmail, cpf: '12345678901', password: 'a-strong-password' })
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
});
```

- [ ] **Step 4: Run the e2e test to verify it fails**

Ensure MySQL is up: `docker compose up -d mysql`
Run: `cd apps/api && pnpm run test:e2e auth.e2e-spec.ts`
Expected: FAIL — 404, no `/tenants/:tenantSlug/auth/*` routes registered yet.

- [ ] **Step 5: Implement the controller**

Create `apps/api/src/identity/infrastructure/auth.controller.ts`:

```typescript
import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Res,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { registerParticipantSchema, loginParticipantSchema } from '@fenac-platform/contracts';
import type { RegisterParticipantDto, LoginParticipantDto } from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { AuthenticateUserUseCase } from '../application/use-cases/authenticate-user.use-case';
import { ParticipantTokenService } from './participant-token.service';

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('tenants/:tenantSlug/auth')
export class AuthController {
  constructor(
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly registerUser: RegisterUserUseCase,
    private readonly authenticateUser: AuthenticateUserUseCase,
    private readonly tokenService: ParticipantTokenService,
  ) {}

  @Post('register')
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(registerParticipantSchema))
  async register(@Param('tenantSlug') tenantSlug: string, @Body() body: RegisterParticipantDto) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    const user = await this.registerUser.execute({
      tenantId: tenant.id,
      name: body.name,
      email: body.email,
      cpf: body.cpf,
      password: body.password,
    });

    return { id: user.id, name: user.name, email: user.email };
  }

  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginParticipantSchema))
  async login(
    @Param('tenantSlug') tenantSlug: string,
    @Body() body: LoginParticipantDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');

    let user;
    try {
      user = await this.authenticateUser.execute({
        tenantId: tenant.id,
        identifier: body.identifier,
        password: body.password,
      });
    } catch {
      throw new UnauthorizedException('invalid credentials');
    }

    const accessToken = this.tokenService.signAccessToken({ sub: user.id, tenantId: tenant.id });
    const refreshToken = this.tokenService.signRefreshToken({ sub: user.id, tenantId: tenant.id });

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Param('tenantSlug') _tenantSlug: string, @Body() _body: unknown, @Res({ passthrough: true }) response: Response) {
    return this.doRefresh(response);
  }

  private doRefresh(response: Response) {
    const request = response.req as unknown as { cookies?: Record<string, string> };
    const refreshToken = request.cookies?.refreshToken;
    if (!refreshToken) throw new UnauthorizedException();

    try {
      const payload = this.tokenService.verify(refreshToken);
      const accessToken = this.tokenService.signAccessToken({
        sub: payload.sub,
        tenantId: payload.tenantId,
      });
      return { accessToken };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

- [ ] **Step 6: Wire the module**

Create `apps/api/src/identity/identity.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthController } from './infrastructure/auth.controller';
import { ParticipantTokenService } from './infrastructure/participant-token.service';
import { ParticipantAuthGuard } from './infrastructure/participant-auth.guard';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { USERS_REPOSITORY } from './application/ports/users-repository.port';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { AuthenticateUserUseCase } from './application/use-cases/authenticate-user.use-case';

@Module({
  imports: [
    TenantsModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    AuthenticateUserUseCase,
    ParticipantTokenService,
    ParticipantAuthGuard,
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
  exports: [ParticipantAuthGuard, ParticipantTokenService],
})
export class IdentityModule {}
```

Open `apps/api/src/tenants/tenants.module.ts` and confirm it has `exports: [FindTenantBySlugUseCase]` in its `@Module` decorator — add that line if missing, since `IdentityModule` now needs it.

Open `apps/api/src/app.module.ts` and add `IdentityModule` to its `imports` array, importing from `./identity/identity.module`.

- [ ] **Step 7: Run the e2e test to verify it passes**

Run: `cd apps/api && pnpm run test:e2e auth.e2e-spec.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 8: Run the full test suite**

Run: `cd apps/api && pnpm run test && pnpm run test:integration && pnpm run test:e2e`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src apps/api/test apps/api/package.json .env.example ../../pnpm-lock.yaml
git commit -m "feat(identity): expose AuthController (register/login/refresh)"
```

---

### Task 11: `GET /tenants/:tenantSlug/auth/me` (e2e TDD)

**Files:**
- Modify: `apps/api/src/identity/infrastructure/auth.controller.ts`
- Modify: `apps/api/src/identity/identity.module.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `ParticipantAuthGuard` (Task 8), `request.participant` (attached by the guard).
- Produces: `GET /tenants/:tenantSlug/auth/me` — 200 with `{ id, name, email }` when authenticated, 401 otherwise. Proves the whole participant-auth chain works end-to-end against a real running app.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/test/auth.e2e-spec.ts`, inside the existing `describe` block:

```typescript
  it('returns the authenticated participant on /me, and 401 without a token', async () => {
    await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/register`)
      .send({ name: 'Ana Silva', email: userEmail, cpf: '12345678901', password: 'a-strong-password' })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantSlug}/auth/login`)
      .send({ identifier: userEmail, password: 'a-strong-password' })
      .expect(200);

    const accessToken = loginResponse.body.accessToken as string;

    const meResponse = await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body.email).toBe(userEmail);

    await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/auth/me`)
      .expect(401);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm run test:e2e auth.e2e-spec.ts`
Expected: FAIL — 404, no `GET /tenants/:tenantSlug/auth/me` route yet.

- [ ] **Step 3: Add the `/me` endpoint**

In `apps/api/src/identity/infrastructure/auth.controller.ts`, add these imports:

```typescript
import { Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ParticipantAuthGuard } from './participant-auth.guard';
import { USERS_REPOSITORY, UsersRepositoryPort } from '../application/ports/users-repository.port';
import { Inject } from '@nestjs/common';
```

Add `@Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepositoryPort,` as a new constructor parameter, and add this method to the class:

```typescript
  @Get('me')
  @UseGuards(ParticipantAuthGuard)
  async me(@Req() request: Request & { participant?: { id: string } }) {
    const user = await this.usersRepository.findById(request.participant!.id);
    if (!user) throw new NotFoundException();
    return { id: user.id, name: user.name, email: user.email };
  }
```

In `apps/api/src/identity/identity.module.ts`, add `ParticipantAuthGuard` is already a provider — confirm it stays there (it is, from Task 10); no other changes needed since `USERS_REPOSITORY` is already provided.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm run test:e2e auth.e2e-spec.ts`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Run the full test suite**

Run: `cd apps/api && pnpm run test && pnpm run test:integration && pnpm run test:e2e`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/identity apps/api/test
git commit -m "feat(identity): add GET /tenants/:tenantSlug/auth/me"
```

---

## Self-Review Notes

- **Spec coverage**: §3's participant auth requirements (email-or-CPF login, JWT access+refresh via httpOnly cookie, no 2FA) → Tasks 6-11. §6's `User` entity (CPF as first-class identity) → Task 2, 4. §2's clean-architecture layering → every task follows the same domain/application/infrastructure split already established by `tenants`. Admin auth, RBAC, tenant-context auto-scoping, and audit logging are explicitly OUT of scope for this plan — they're Plan 2b ("Admin Identity & Authorization"), a separate plan, per the scope-check split made when this plan was written.
- **Type consistency checked**: `UsersRepositoryPort.save/findByEmailOrCpf/findById` (Task 4) match every call site in Tasks 5, 6, 10, 11. `PasswordHasherPort.hash/compare` (Task 3) match usage in Tasks 5-6. `ParticipantTokenService.signAccessToken/signRefreshToken/verify` (Task 7) match usage in Tasks 8, 10, 11. `request.participant` shape (`{id, tenantId}`, Task 8) matches what Task 11's `/me` handler reads.
- **No placeholders**: every step shows full file contents or an exact runnable command with expected output.
