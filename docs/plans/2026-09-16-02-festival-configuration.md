# Festival Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a tenant's ORGANIZER admin the ability to configure a festival edition — its registration/voting windows, geographic eligibility, judging stages with advancement quotas, and weighted grading criteria per stage — before inscriptions open.

**Architecture:** A new `apps/api/src/festivals/` Clean Architecture module (domain → application → infrastructure), following the exact conventions already established by the merged `tenants` and `admin-identity` modules: immutable domain entities with static factories, `TenantScopedRepository`-based Prisma repositories paired with in-memory test doubles, `@Roles('ORGANIZER')`/`RolesGuard` for write access, `@AuditLog()`/`AuditLogInterceptor` for sensitive-action logging, and a domain-error → HTTP-filter mapping for conflicts and invalid state transitions. `AdminAuthGuard` and `FindTenantBySlugUseCase` are reused, not recreated.

**Tech Stack:** NestJS, Prisma/MySQL, Zod (`packages/contracts`), Jest (unit + integration + e2e via supertest).

**Spec:** `docs/specs/2026-09-15-fenac-platform-architecture-design.md` (§2 Clean Architecture/multi-tenancy, §6 domain model), `docs/discovery/01-data-model.md` (legacy `festivals`/`festival_grades`/`festival_cities` tables), `docs/discovery/05-decisions-and-improvements.md` (decisions 1, 3, 6).

## Scope Decision

The original request for this sub-project covered six entities: Festival, Stage, GradeCriterion, FestivalCategory, FestivalCity, and Instrument. Per the Scope Check in `writing-plans` ("if the spec covers multiple independent subsystems... suggest breaking into separate plans"), this plan is **narrowed to Festival + Stage + GradeCriterion** — exactly the flow the architecture spec's frontend section describes as one screen ("Configuração do Festival: fases + critérios + quotas num fluxo único"), and the entities that other future modules (Judging/Voting) directly depend on. `FestivalCategory` (award labels), `FestivalCity` (presentation cities), and `Instrument` (catalog) are simpler, independent CRUD resources with no dependents yet — they become their own follow-up plan once this one is merged. This keeps each plan shippable as working, testable software on its own, matching the pattern already used for `tenants` → `identity` → `admin-identity`.

## Global Constraints

- **Clean Architecture per module**: `domain` has zero NestJS/Prisma imports. `application` (use cases + repository ports) may use `@Injectable()`/`@Inject()` from `@nestjs/common` as a pragmatic exception. `infrastructure` holds Prisma repositories, controllers, and DI wiring.
- **Multi-tenancy**: every repository extends `TenantScopedRepository` (`apps/api/src/common/repositories/tenant-scoped.repository.ts`) and calls `this.tenantScoped(tenantId, where)` on every query — never a raw `where` object referencing tenant-owned rows.
- **Domain entities are immutable**: static factories (`.create`/`.restore`), instance methods return NEW instances, never mutate `this`.
- **Domain error → HTTP filter mapping**: domain layer throws plain `Error` subclasses (zero framework imports); a dedicated `@Catch()` filter in `apps/api/src/common/filters/` maps each to its HTTP status. Never let a bare domain error reach NestJS's default handler (it becomes an unhandled 500).
- **RBAC**: every write endpoint uses `@UseGuards(RolesGuard) @Roles('ORGANIZER')` (in addition to `AdminAuthGuard`, which populates `request.admin`). Read endpoints require `AdminAuthGuard` only (any authenticated admin, any role).
- **Audit logging**: every write endpoint uses `@UseInterceptors(AuditLogInterceptor) @AuditLog(action, extractTarget)`.
- **Tenant-isolation check at the controller boundary**: `AdminAuthGuard` only verifies the JWT — it does NOT check that the token's `tenantId` matches the `:tenantSlug` in the URL. Every controller handler must do that check itself (reuse a private helper, do not skip it on any route).
- **`import type` for port interfaces and other type-only names used in decorated constructors** — this project has repeatedly hit TS1272 build failures (`nest build` fails under `isolatedModules`+`emitDecoratorMetadata`) when a type-only import is written as a value import and referenced in a decorated class's constructor. Every task below already uses `import type` where needed; follow the same pattern for anything new.
- **In-memory repository test doubles use `Promise.resolve(...)`, not a bare `async` function body with no `await`** — this codebase's ESLint config flags `@typescript-eslint/require-await` on async functions that never await anything.
- **Every task must pass `pnpm run build` and `pnpm run lint` (from `apps/api/`), not just `pnpm run test`** — this project has repeatedly had TS1272 build errors and Prettier lint regressions slip through when only unit tests were checked.

---

### Task 1: Prisma schema — `Festival`, `Stage`, `GradeCriterion`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `FestivalStatus` enum (`DRAFT`/`OPEN`/`CLOSED`), `Festival`/`Stage`/`GradeCriterion` Prisma models — consumed by every later task's repository layer.

- [ ] **Step 1: Add the models to `apps/api/prisma/schema.prisma`**

Add this enum near the existing `AdminStatus` enum:

```prisma
enum FestivalStatus {
  DRAFT
  OPEN
  CLOSED
}
```

Add `festivals Festival[]` to the existing `Tenant` model's field list (alongside `users` and `adminUsers`):

```prisma
model Tenant {
  id         String       @id @default(uuid())
  name       String
  document   String       @unique
  slug       String       @unique
  status     TenantStatus @default(ACTIVE)
  createdAt  DateTime     @default(now()) @map("created_at")
  updatedAt  DateTime     @updatedAt @map("updated_at")
  users      User[]
  adminUsers AdminUser[]
  festivals  Festival[]

  @@map("tenants")
}
```

Add the three new models at the end of the file:

```prisma
model Festival {
  id                String         @id @default(uuid())
  tenantId          String         @map("tenant_id")
  tenant            Tenant         @relation(fields: [tenantId], references: [id])
  number            Int
  year              Int
  name              String
  registrationBegin DateTime       @map("registration_begin")
  registrationEnd   DateTime       @map("registration_end")
  votingBegin       DateTime?      @map("voting_begin")
  votingEnd         DateTime?      @map("voting_end")
  status            FestivalStatus @default(DRAFT)
  inscriptionFee    Decimal        @map("inscription_fee") @db.Decimal(8, 2)
  regulationUrl     String?        @map("regulation_url")
  allowedStates     Json           @map("allowed_states")
  createdAt         DateTime       @default(now()) @map("created_at")
  updatedAt         DateTime       @updatedAt @map("updated_at")
  stages            Stage[]

  @@unique([tenantId, number, year])
  @@map("festivals")
}

model Stage {
  id               String   @id @default(uuid())
  tenantId         String   @map("tenant_id")
  festivalId       String   @map("festival_id")
  festival         Festival @relation(fields: [festivalId], references: [id])
  name             String
  order            Int
  advancementQuota Int?     @map("advancement_quota")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  gradeCriteria    GradeCriterion[]

  @@map("stages")
}

model GradeCriterion {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  stageId   String   @map("stage_id")
  stage     Stage    @relation(fields: [stageId], references: [id])
  name      String
  weight    Decimal  @db.Decimal(5, 2)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("grade_criteria")
}
```

- [ ] **Step 2: Generate and apply the migration**

Run (ensure MySQL is up first — `docker compose up -d mysql` from the repo root if needed):

```bash
cd apps/api && pnpm exec prisma migrate dev --name add_festivals_stages_grade_criteria
```

Expected: migration generated and applied with no errors. If `prisma migrate dev` fails with `P3014` (shadow database permission), this is a known, recurring local-environment gap in this project (hit in every prior plan) — grant the local MySQL user shadow-database creation rights and retry; do not work around it any other way.

- [ ] **Step 3: Regenerate the Prisma client**

```bash
pnpm exec prisma generate
```

- [ ] **Step 4: Verify the build still compiles**

```bash
pnpm run build
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(prisma): add Festival, Stage, GradeCriterion models"
```

---

### Task 2: `Festival` domain entity + domain errors

**Files:**
- Create: `apps/api/src/festivals/domain/festival.entity.ts`
- Create: `apps/api/src/festivals/domain/festival.entity.spec.ts`
- Create: `apps/api/src/festivals/domain/festival-conflict.error.ts`
- Create: `apps/api/src/festivals/domain/invalid-festival-state.error.ts`

**Interfaces:**
- Consumes: nothing (zero framework/Prisma dependencies — pure domain).
- Produces: `Festival` class (`.create`/`.restore`/`.updateDetails`/`.publish`/`.close`, getters for all props), `FestivalStatus` type (`'DRAFT'|'OPEN'|'CLOSED'`), `BRAZILIAN_STATES` const + `BrazilianState` type, `FestivalProps` interface, `CreateFestivalInput`/`UpdateFestivalDetailsInput` interfaces, `FestivalConflictError`, `InvalidFestivalStateError` — consumed by every later task in this plan.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/festivals/domain/festival.entity.spec.ts`:

```typescript
import { Festival } from './festival.entity';

const baseInput = {
  tenantId: 'tenant-1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: new Date('2026-01-01T08:00:00Z'),
  registrationEnd: new Date('2026-03-01T18:00:00Z'),
  inscriptionFee: 25,
};

describe('Festival', () => {
  it('creates a DRAFT festival with no state restriction by default', () => {
    const festival = Festival.create(baseInput);

    expect(festival.id).toBeDefined();
    expect(festival.status).toBe('DRAFT');
    expect(festival.allowedStates).toEqual([]);
    expect(festival.votingBegin).toBeNull();
  });

  it('rejects a registrationBegin that is not before registrationEnd', () => {
    expect(() =>
      Festival.create({
        ...baseInput,
        registrationBegin: new Date('2026-03-01T18:00:00Z'),
        registrationEnd: new Date('2026-01-01T08:00:00Z'),
      }),
    ).toThrow('registrationBegin must be before registrationEnd');
  });

  it('rejects an invalid Brazilian state code', () => {
    expect(() =>
      Festival.create({ ...baseInput, allowedStates: ['XX'] as never }),
    ).toThrow('invalid state: XX');
  });

  it('publish() moves a DRAFT festival to OPEN', () => {
    const festival = Festival.create(baseInput);
    const published = festival.publish();

    expect(published.status).toBe('OPEN');
    expect(festival.status).toBe('DRAFT'); // original instance untouched
  });

  it('publish() rejects a festival that is not DRAFT', () => {
    const festival = Festival.create(baseInput).publish();
    expect(() => festival.publish()).toThrow(
      'only a DRAFT festival can be published',
    );
  });

  it('close() moves an OPEN festival to CLOSED, and rejects a non-OPEN one', () => {
    const draft = Festival.create(baseInput);
    expect(() => draft.close()).toThrow('only an OPEN festival can be closed');

    const closed = draft.publish().close();
    expect(closed.status).toBe('CLOSED');
  });

  it('updateDetails() returns a new instance with updated fields, preserving id/status', () => {
    const festival = Festival.create(baseInput);
    const updated = festival.updateDetails({
      ...baseInput,
      name: 'FENAC 2026 — Edição Revisada',
      inscriptionFee: 30,
    });

    expect(updated.id).toBe(festival.id);
    expect(updated.status).toBe('DRAFT');
    expect(updated.name).toBe('FENAC 2026 — Edição Revisada');
    expect(updated.inscriptionFee).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm test festival.entity.spec.ts`
Expected: FAIL — `Cannot find module './festival.entity'`.

- [ ] **Step 3: Implement the domain errors**

Create `apps/api/src/festivals/domain/festival-conflict.error.ts`:

```typescript
export class FestivalConflictError extends Error {
  constructor(
    public readonly number: number,
    public readonly year: number,
  ) {
    super(`Festival ${number}/${year} already exists for this tenant`);
    this.name = 'FestivalConflictError';
  }
}
```

Create `apps/api/src/festivals/domain/invalid-festival-state.error.ts`:

```typescript
export class InvalidFestivalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFestivalStateError';
  }
}
```

- [ ] **Step 4: Implement the entity**

Create `apps/api/src/festivals/domain/festival.entity.ts`:

```typescript
import { randomUUID } from 'crypto';
import { InvalidFestivalStateError } from './invalid-festival-state.error';

export type FestivalStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;
export type BrazilianState = (typeof BRAZILIAN_STATES)[number];

export interface FestivalProps {
  id: string;
  tenantId: string;
  number: number;
  year: number;
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin: Date | null;
  votingEnd: Date | null;
  status: FestivalStatus;
  inscriptionFee: number;
  regulationUrl: string | null;
  allowedStates: BrazilianState[];
  createdAt: Date;
  updatedAt: Date;
}

interface FestivalDetailsInput {
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin?: Date | null;
  votingEnd?: Date | null;
  inscriptionFee: number;
  regulationUrl?: string | null;
  allowedStates?: BrazilianState[];
}

export interface CreateFestivalInput extends FestivalDetailsInput {
  tenantId: string;
  number: number;
  year: number;
}

export type UpdateFestivalDetailsInput = FestivalDetailsInput;

function validateDetails(input: FestivalDetailsInput): void {
  if (input.name.trim().length === 0) {
    throw new Error('name must not be empty');
  }
  if (input.registrationBegin.getTime() >= input.registrationEnd.getTime()) {
    throw new Error('registrationBegin must be before registrationEnd');
  }
  const hasVotingBegin = input.votingBegin != null;
  const hasVotingEnd = input.votingEnd != null;
  if (hasVotingBegin !== hasVotingEnd) {
    throw new Error(
      'votingBegin and votingEnd must both be set or both be null',
    );
  }
  if (
    hasVotingBegin &&
    hasVotingEnd &&
    input.votingBegin!.getTime() >= input.votingEnd!.getTime()
  ) {
    throw new Error('votingBegin must be before votingEnd');
  }
  if (input.inscriptionFee < 0) {
    throw new Error('inscriptionFee must not be negative');
  }
  for (const state of input.allowedStates ?? []) {
    if (!(BRAZILIAN_STATES as readonly string[]).includes(state)) {
      throw new Error(`invalid state: ${state}`);
    }
  }
}

export class Festival {
  private constructor(private readonly props: FestivalProps) {}

  static create(input: CreateFestivalInput): Festival {
    if (!Number.isInteger(input.number) || input.number <= 0) {
      throw new Error('number must be a positive integer');
    }
    if (
      !Number.isInteger(input.year) ||
      input.year < 1900 ||
      input.year > 2200
    ) {
      throw new Error('year must be a valid 4-digit year');
    }
    validateDetails(input);

    const now = new Date();
    return new Festival({
      id: randomUUID(),
      tenantId: input.tenantId,
      number: input.number,
      year: input.year,
      name: input.name,
      registrationBegin: input.registrationBegin,
      registrationEnd: input.registrationEnd,
      votingBegin: input.votingBegin ?? null,
      votingEnd: input.votingEnd ?? null,
      status: 'DRAFT',
      inscriptionFee: input.inscriptionFee,
      regulationUrl: input.regulationUrl ?? null,
      allowedStates: input.allowedStates ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: FestivalProps): Festival {
    return new Festival(props);
  }

  updateDetails(input: UpdateFestivalDetailsInput): Festival {
    validateDetails(input);
    return new Festival({
      ...this.props,
      name: input.name,
      registrationBegin: input.registrationBegin,
      registrationEnd: input.registrationEnd,
      votingBegin: input.votingBegin ?? null,
      votingEnd: input.votingEnd ?? null,
      inscriptionFee: input.inscriptionFee,
      regulationUrl: input.regulationUrl ?? null,
      allowedStates: input.allowedStates ?? [],
      updatedAt: new Date(),
    });
  }

  publish(): Festival {
    if (this.props.status !== 'DRAFT') {
      throw new InvalidFestivalStateError(
        'only a DRAFT festival can be published',
      );
    }
    return new Festival({
      ...this.props,
      status: 'OPEN',
      updatedAt: new Date(),
    });
  }

  close(): Festival {
    if (this.props.status !== 'OPEN') {
      throw new InvalidFestivalStateError(
        'only an OPEN festival can be closed',
      );
    }
    return new Festival({
      ...this.props,
      status: 'CLOSED',
      updatedAt: new Date(),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get number(): number {
    return this.props.number;
  }
  get year(): number {
    return this.props.year;
  }
  get name(): string {
    return this.props.name;
  }
  get registrationBegin(): Date {
    return this.props.registrationBegin;
  }
  get registrationEnd(): Date {
    return this.props.registrationEnd;
  }
  get votingBegin(): Date | null {
    return this.props.votingBegin;
  }
  get votingEnd(): Date | null {
    return this.props.votingEnd;
  }
  get status(): FestivalStatus {
    return this.props.status;
  }
  get inscriptionFee(): number {
    return this.props.inscriptionFee;
  }
  get regulationUrl(): string | null {
    return this.props.regulationUrl;
  }
  get allowedStates(): BrazilianState[] {
    return this.props.allowedStates;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/api && pnpm test festival.entity.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Verify build and lint**

```bash
pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/festivals/domain
git commit -m "feat(festivals): add Festival domain entity"
```

---

### Task 3: `FestivalsRepositoryPort` + Prisma/in-memory repositories

**Files:**
- Create: `apps/api/src/festivals/application/ports/festivals-repository.port.ts`
- Create: `apps/api/src/festivals/infrastructure/prisma-festivals.repository.ts`
- Create: `apps/api/src/festivals/infrastructure/in-memory-festivals.repository.ts`
- Create: `apps/api/src/festivals/infrastructure/in-memory-festivals.repository.spec.ts`

**Interfaces:**
- Consumes: `Festival`, `FestivalProps`, `BrazilianState`, `FestivalStatus` (Task 2), `TenantScopedRepository` (`apps/api/src/common/repositories/tenant-scoped.repository.ts`, existing), `PrismaService` (`apps/api/src/prisma/prisma.service.ts`, existing), `FestivalConflictError` (Task 2).
- Produces: `FestivalsRepositoryPort` (`save`, `findById`, `findAllByTenant`), `FESTIVALS_REPOSITORY` Symbol token — consumed by Tasks 4, 5, 12.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/festivals/infrastructure/in-memory-festivals.repository.spec.ts`:

```typescript
import { InMemoryFestivalsRepository } from './in-memory-festivals.repository';
import { Festival } from '../domain/festival.entity';
import { FestivalConflictError } from '../domain/festival-conflict.error';

const input = {
  tenantId: 'tenant-1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: new Date('2026-01-01'),
  registrationEnd: new Date('2026-03-01'),
  inscriptionFee: 25,
};

describe('InMemoryFestivalsRepository', () => {
  it('saves and finds a festival by id, tenant-scoped', async () => {
    const repository = new InMemoryFestivalsRepository();
    const festival = Festival.create(input);
    await repository.save(festival);

    expect(await repository.findById('tenant-1', festival.id)).not.toBeNull();
    expect(await repository.findById('tenant-2', festival.id)).toBeNull();
  });

  it('rejects saving a second festival with the same tenant/number/year', async () => {
    const repository = new InMemoryFestivalsRepository();
    await repository.save(Festival.create(input));

    await expect(repository.save(Festival.create(input))).rejects.toThrow(
      FestivalConflictError,
    );
  });

  it('allows the same number/year for a different tenant', async () => {
    const repository = new InMemoryFestivalsRepository();
    await repository.save(Festival.create(input));

    await expect(
      repository.save(Festival.create({ ...input, tenantId: 'tenant-2' })),
    ).resolves.not.toThrow();
  });

  it('findAllByTenant only returns that tenant\'s festivals', async () => {
    const repository = new InMemoryFestivalsRepository();
    await repository.save(Festival.create(input));
    await repository.save(Festival.create({ ...input, tenantId: 'tenant-2' }));

    const results = await repository.findAllByTenant('tenant-1');
    expect(results).toHaveLength(1);
    expect(results[0].tenantId).toBe('tenant-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm test in-memory-festivals.repository.spec.ts`
Expected: FAIL — `Cannot find module './in-memory-festivals.repository'`.

- [ ] **Step 3: Implement the port**

Create `apps/api/src/festivals/application/ports/festivals-repository.port.ts`:

```typescript
import { Festival } from '../../domain/festival.entity';

export interface FestivalsRepositoryPort {
  save(festival: Festival): Promise<void>;
  findById(tenantId: string, id: string): Promise<Festival | null>;
  findAllByTenant(tenantId: string): Promise<Festival[]>;
}

export const FESTIVALS_REPOSITORY = Symbol('FESTIVALS_REPOSITORY');
```

- [ ] **Step 4: Implement the in-memory repository**

Create `apps/api/src/festivals/infrastructure/in-memory-festivals.repository.ts`:

```typescript
import { Festival } from '../domain/festival.entity';
import { FestivalConflictError } from '../domain/festival-conflict.error';
import type { FestivalsRepositoryPort } from '../application/ports/festivals-repository.port';

export class InMemoryFestivalsRepository implements FestivalsRepositoryPort {
  private readonly festivals = new Map<string, Festival>();

  save(festival: Festival): Promise<void> {
    const conflict = [...this.festivals.values()].find(
      (existing) =>
        existing.id !== festival.id &&
        existing.tenantId === festival.tenantId &&
        existing.number === festival.number &&
        existing.year === festival.year,
    );
    if (conflict) {
      throw new FestivalConflictError(festival.number, festival.year);
    }
    this.festivals.set(festival.id, festival);
    return Promise.resolve();
  }

  findById(tenantId: string, id: string): Promise<Festival | null> {
    const festival = this.festivals.get(id);
    return Promise.resolve(
      festival && festival.tenantId === tenantId ? festival : null,
    );
  }

  findAllByTenant(tenantId: string): Promise<Festival[]> {
    return Promise.resolve(
      [...this.festivals.values()].filter((f) => f.tenantId === tenantId),
    );
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/api && pnpm test in-memory-festivals.repository.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Implement the Prisma repository**

Create `apps/api/src/festivals/infrastructure/prisma-festivals.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { Festival } from '../domain/festival.entity';
import type { FestivalProps, BrazilianState } from '../domain/festival.entity';
import { FestivalConflictError } from '../domain/festival-conflict.error';
import type { FestivalsRepositoryPort } from '../application/ports/festivals-repository.port';

interface FestivalRow {
  id: string;
  tenantId: string;
  number: number;
  year: number;
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin: Date | null;
  votingEnd: Date | null;
  status: string;
  inscriptionFee: Prisma.Decimal;
  regulationUrl: string | null;
  allowedStates: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaFestivalsRepository
  extends TenantScopedRepository
  implements FestivalsRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(festival: Festival): Promise<void> {
    try {
      await this.prisma.festival.upsert({
        where: { id: festival.id },
        create: {
          id: festival.id,
          tenantId: festival.tenantId,
          number: festival.number,
          year: festival.year,
          name: festival.name,
          registrationBegin: festival.registrationBegin,
          registrationEnd: festival.registrationEnd,
          votingBegin: festival.votingBegin,
          votingEnd: festival.votingEnd,
          status: festival.status,
          inscriptionFee: festival.inscriptionFee,
          regulationUrl: festival.regulationUrl,
          allowedStates: festival.allowedStates,
          createdAt: festival.createdAt,
          updatedAt: festival.updatedAt,
        },
        update: {
          name: festival.name,
          registrationBegin: festival.registrationBegin,
          registrationEnd: festival.registrationEnd,
          votingBegin: festival.votingBegin,
          votingEnd: festival.votingEnd,
          status: festival.status,
          inscriptionFee: festival.inscriptionFee,
          regulationUrl: festival.regulationUrl,
          allowedStates: festival.allowedStates,
          updatedAt: festival.updatedAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new FestivalConflictError(festival.number, festival.year);
      }
      throw error;
    }
  }

  async findById(tenantId: string, id: string): Promise<Festival | null> {
    const row = await this.prisma.festival.findFirst({
      where: this.tenantScoped(tenantId, { id }),
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findAllByTenant(tenantId: string): Promise<Festival[]> {
    const rows = await this.prisma.festival.findMany({
      where: this.tenantScoped(tenantId),
      orderBy: [{ year: 'desc' }, { number: 'desc' }],
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: FestivalRow): Festival {
    const props: FestivalProps = {
      id: row.id,
      tenantId: row.tenantId,
      number: row.number,
      year: row.year,
      name: row.name,
      registrationBegin: row.registrationBegin,
      registrationEnd: row.registrationEnd,
      votingBegin: row.votingBegin,
      votingEnd: row.votingEnd,
      status: row.status as FestivalProps['status'],
      inscriptionFee: Number(row.inscriptionFee),
      regulationUrl: row.regulationUrl,
      allowedStates: (row.allowedStates as BrazilianState[] | null) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Festival.restore(props);
  }
}
```

- [ ] **Step 7: Verify build and lint**

```bash
pnpm run build && pnpm run lint
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/festivals
git commit -m "feat(festivals): add FestivalsRepositoryPort and repositories"
```

---

### Task 4: `CreateFestivalUseCase` + `ListFestivalsUseCase` + `GetFestivalUseCase`

**Files:**
- Create: `apps/api/src/festivals/application/use-cases/create-festival.use-case.ts`
- Create: `apps/api/src/festivals/application/use-cases/create-festival.use-case.spec.ts`
- Create: `apps/api/src/festivals/application/use-cases/list-festivals.use-case.ts`
- Create: `apps/api/src/festivals/application/use-cases/get-festival.use-case.ts`
- Create: `apps/api/src/festivals/application/use-cases/get-festival.use-case.spec.ts`

**Interfaces:**
- Consumes: `FestivalsRepositoryPort`, `FESTIVALS_REPOSITORY` (Task 3), `Festival`, `BrazilianState` (Task 2).
- Produces: `CreateFestivalUseCase.execute(input): Promise<Festival>`, `ListFestivalsUseCase.execute(tenantId): Promise<Festival[]>`, `GetFestivalUseCase.execute(tenantId, festivalId): Promise<Festival | null>` — consumed by Task 12's controller.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/festivals/application/use-cases/create-festival.use-case.spec.ts`:

```typescript
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';
import { FestivalConflictError } from '../../domain/festival-conflict.error';

const input = {
  tenantId: 'tenant-1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: new Date('2026-01-01'),
  registrationEnd: new Date('2026-03-01'),
  inscriptionFee: 25,
};

describe('CreateFestivalUseCase', () => {
  it('creates and persists a festival', async () => {
    const repository = new InMemoryFestivalsRepository();
    const useCase = new CreateFestivalUseCase(repository);

    const festival = await useCase.execute(input);

    expect(festival.status).toBe('DRAFT');
    expect(await repository.findById('tenant-1', festival.id)).not.toBeNull();
  });

  it('rejects a duplicate number/year for the same tenant', async () => {
    const repository = new InMemoryFestivalsRepository();
    const useCase = new CreateFestivalUseCase(repository);
    await useCase.execute(input);

    await expect(useCase.execute(input)).rejects.toThrow(FestivalConflictError);
  });
});
```

Create `apps/api/src/festivals/application/use-cases/get-festival.use-case.spec.ts`:

```typescript
import { GetFestivalUseCase } from './get-festival.use-case';
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';

describe('GetFestivalUseCase', () => {
  it('returns null for a festival that does not belong to the given tenant', async () => {
    const repository = new InMemoryFestivalsRepository();
    const festival = await new CreateFestivalUseCase(repository).execute({
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    });

    const useCase = new GetFestivalUseCase(repository);
    expect(await useCase.execute('tenant-1', festival.id)).not.toBeNull();
    expect(await useCase.execute('tenant-2', festival.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && pnpm test create-festival.use-case.spec.ts get-festival.use-case.spec.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the use cases**

Create `apps/api/src/festivals/application/use-cases/create-festival.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import type { BrazilianState } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

export interface CreateFestivalUseCaseInput {
  tenantId: string;
  number: number;
  year: number;
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin?: Date | null;
  votingEnd?: Date | null;
  inscriptionFee: number;
  regulationUrl?: string | null;
  allowedStates?: BrazilianState[];
}

@Injectable()
export class CreateFestivalUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(input: CreateFestivalUseCaseInput): Promise<Festival> {
    const festival = Festival.create(input);
    await this.festivalsRepository.save(festival);
    return festival;
  }
}
```

Create `apps/api/src/festivals/application/use-cases/list-festivals.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

@Injectable()
export class ListFestivalsUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(tenantId: string): Promise<Festival[]> {
    return this.festivalsRepository.findAllByTenant(tenantId);
  }
}
```

Create `apps/api/src/festivals/application/use-cases/get-festival.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

@Injectable()
export class GetFestivalUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(tenantId: string, festivalId: string): Promise<Festival | null> {
    return this.festivalsRepository.findById(tenantId, festivalId);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/api && pnpm test create-festival.use-case.spec.ts get-festival.use-case.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify build and lint**

```bash
pnpm run build && pnpm run lint
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/festivals/application/use-cases
git commit -m "feat(festivals): add Create/List/GetFestival use cases"
```

---

### Task 5: `UpdateFestivalDetailsUseCase` + `PublishFestivalUseCase` + `CloseFestivalUseCase`

**Files:**
- Create: `apps/api/src/festivals/application/use-cases/update-festival-details.use-case.ts`
- Create: `apps/api/src/festivals/application/use-cases/publish-festival.use-case.ts`
- Create: `apps/api/src/festivals/application/use-cases/publish-festival.use-case.spec.ts`
- Create: `apps/api/src/festivals/application/use-cases/close-festival.use-case.ts`

**Interfaces:**
- Consumes: `FestivalsRepositoryPort`, `FESTIVALS_REPOSITORY` (Task 3), `Festival`, `InvalidFestivalStateError` (Task 2).
- Produces: `UpdateFestivalDetailsUseCase.execute(input): Promise<Festival | null>`, `PublishFestivalUseCase.execute(tenantId, festivalId): Promise<Festival | null>`, `CloseFestivalUseCase.execute(tenantId, festivalId): Promise<Festival | null>` — `null` means "not found for this tenant"; a state-transition violation throws `InvalidFestivalStateError` (not returned as null). Consumed by Task 12's controller.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/festivals/application/use-cases/publish-festival.use-case.spec.ts`:

```typescript
import { PublishFestivalUseCase } from './publish-festival.use-case';
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';
import { InvalidFestivalStateError } from '../../domain/invalid-festival-state.error';

describe('PublishFestivalUseCase', () => {
  it('publishes a DRAFT festival', async () => {
    const repository = new InMemoryFestivalsRepository();
    const festival = await new CreateFestivalUseCase(repository).execute({
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    });

    const useCase = new PublishFestivalUseCase(repository);
    const published = await useCase.execute('tenant-1', festival.id);

    expect(published?.status).toBe('OPEN');
  });

  it('returns null for a festival that does not belong to the tenant', async () => {
    const repository = new InMemoryFestivalsRepository();
    const useCase = new PublishFestivalUseCase(repository);
    expect(await useCase.execute('tenant-1', 'nonexistent-id')).toBeNull();
  });

  it('rethrows InvalidFestivalStateError for a festival that is already OPEN', async () => {
    const repository = new InMemoryFestivalsRepository();
    const festival = await new CreateFestivalUseCase(repository).execute({
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    });
    const useCase = new PublishFestivalUseCase(repository);
    await useCase.execute('tenant-1', festival.id);

    await expect(useCase.execute('tenant-1', festival.id)).rejects.toThrow(
      InvalidFestivalStateError,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm test publish-festival.use-case.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the use cases**

Create `apps/api/src/festivals/application/use-cases/update-festival-details.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import type { BrazilianState } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

export interface UpdateFestivalDetailsUseCaseInput {
  tenantId: string;
  festivalId: string;
  name: string;
  registrationBegin: Date;
  registrationEnd: Date;
  votingBegin?: Date | null;
  votingEnd?: Date | null;
  inscriptionFee: number;
  regulationUrl?: string | null;
  allowedStates?: BrazilianState[];
}

@Injectable()
export class UpdateFestivalDetailsUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(
    input: UpdateFestivalDetailsUseCaseInput,
  ): Promise<Festival | null> {
    const existing = await this.festivalsRepository.findById(
      input.tenantId,
      input.festivalId,
    );
    if (!existing) return null;

    const updated = existing.updateDetails(input);
    await this.festivalsRepository.save(updated);
    return updated;
  }
}
```

Create `apps/api/src/festivals/application/use-cases/publish-festival.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

@Injectable()
export class PublishFestivalUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(tenantId: string, festivalId: string): Promise<Festival | null> {
    const existing = await this.festivalsRepository.findById(tenantId, festivalId);
    if (!existing) return null;

    const published = existing.publish();
    await this.festivalsRepository.save(published);
    return published;
  }
}
```

Create `apps/api/src/festivals/application/use-cases/close-festival.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Festival } from '../../domain/festival.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';

@Injectable()
export class CloseFestivalUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
  ) {}

  async execute(tenantId: string, festivalId: string): Promise<Festival | null> {
    const existing = await this.festivalsRepository.findById(tenantId, festivalId);
    if (!existing) return null;

    const closed = existing.close();
    await this.festivalsRepository.save(closed);
    return closed;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm test publish-festival.use-case.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify build and lint**

```bash
pnpm run build && pnpm run lint
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/festivals/application/use-cases
git commit -m "feat(festivals): add UpdateFestivalDetails/Publish/CloseFestival use cases"
```

---

### Task 6: `Stage` domain entity + repositories

**Files:**
- Create: `apps/api/src/festivals/domain/stage.entity.ts`
- Create: `apps/api/src/festivals/domain/stage.entity.spec.ts`
- Create: `apps/api/src/festivals/application/ports/stages-repository.port.ts`
- Create: `apps/api/src/festivals/infrastructure/prisma-stages.repository.ts`
- Create: `apps/api/src/festivals/infrastructure/in-memory-stages.repository.ts`

**Interfaces:**
- Consumes: `TenantScopedRepository`, `PrismaService` (existing).
- Produces: `Stage` class (`.create`/`.restore`, getters), `StageProps`, `StagesRepositoryPort` (`save`, `findById`, `findAllByFestival`), `STAGES_REPOSITORY` Symbol — consumed by Task 7, Task 12.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/festivals/domain/stage.entity.spec.ts`:

```typescript
import { Stage } from './stage.entity';

describe('Stage', () => {
  it('creates a stage with a null advancementQuota by default', () => {
    const stage = Stage.create({
      tenantId: 'tenant-1',
      festivalId: 'festival-1',
      name: 'Classificatória',
      order: 1,
    });

    expect(stage.id).toBeDefined();
    expect(stage.advancementQuota).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: '  ',
        order: 1,
      }),
    ).toThrow('name must not be empty');
  });

  it('rejects a non-positive order', () => {
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: 'Final',
        order: 0,
      }),
    ).toThrow('order must be a positive integer');
  });

  it('rejects a non-positive advancementQuota when provided', () => {
    expect(() =>
      Stage.create({
        tenantId: 'tenant-1',
        festivalId: 'festival-1',
        name: 'Semifinal',
        order: 2,
        advancementQuota: 0,
      }),
    ).toThrow('advancementQuota must be a positive integer when set');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm test stage.entity.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the entity**

Create `apps/api/src/festivals/domain/stage.entity.ts`:

```typescript
import { randomUUID } from 'crypto';

export interface StageProps {
  id: string;
  tenantId: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota: number | null;
  createdAt: Date;
}

export interface CreateStageInput {
  tenantId: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota?: number | null;
}

export class Stage {
  private constructor(private readonly props: StageProps) {}

  static create(input: CreateStageInput): Stage {
    if (input.name.trim().length === 0) {
      throw new Error('name must not be empty');
    }
    if (!Number.isInteger(input.order) || input.order < 1) {
      throw new Error('order must be a positive integer');
    }
    if (
      input.advancementQuota !== undefined &&
      input.advancementQuota !== null &&
      (!Number.isInteger(input.advancementQuota) || input.advancementQuota < 1)
    ) {
      throw new Error('advancementQuota must be a positive integer when set');
    }

    return new Stage({
      id: randomUUID(),
      tenantId: input.tenantId,
      festivalId: input.festivalId,
      name: input.name,
      order: input.order,
      advancementQuota: input.advancementQuota ?? null,
      createdAt: new Date(),
    });
  }

  static restore(props: StageProps): Stage {
    return new Stage(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get festivalId(): string {
    return this.props.festivalId;
  }
  get name(): string {
    return this.props.name;
  }
  get order(): number {
    return this.props.order;
  }
  get advancementQuota(): number | null {
    return this.props.advancementQuota;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm test stage.entity.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the port and repositories**

Create `apps/api/src/festivals/application/ports/stages-repository.port.ts`:

```typescript
import { Stage } from '../../domain/stage.entity';

export interface StagesRepositoryPort {
  save(stage: Stage): Promise<void>;
  findById(tenantId: string, id: string): Promise<Stage | null>;
  findAllByFestival(tenantId: string, festivalId: string): Promise<Stage[]>;
}

export const STAGES_REPOSITORY = Symbol('STAGES_REPOSITORY');
```

Create `apps/api/src/festivals/infrastructure/in-memory-stages.repository.ts`:

```typescript
import { Stage } from '../domain/stage.entity';
import type { StagesRepositoryPort } from '../application/ports/stages-repository.port';

export class InMemoryStagesRepository implements StagesRepositoryPort {
  private readonly stages = new Map<string, Stage>();

  save(stage: Stage): Promise<void> {
    this.stages.set(stage.id, stage);
    return Promise.resolve();
  }

  findById(tenantId: string, id: string): Promise<Stage | null> {
    const stage = this.stages.get(id);
    return Promise.resolve(
      stage && stage.tenantId === tenantId ? stage : null,
    );
  }

  findAllByFestival(tenantId: string, festivalId: string): Promise<Stage[]> {
    return Promise.resolve(
      [...this.stages.values()].filter(
        (s) => s.tenantId === tenantId && s.festivalId === festivalId,
      ),
    );
  }
}
```

Create `apps/api/src/festivals/infrastructure/prisma-stages.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { Stage } from '../domain/stage.entity';
import type { StageProps } from '../domain/stage.entity';
import type { StagesRepositoryPort } from '../application/ports/stages-repository.port';

interface StageRow {
  id: string;
  tenantId: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota: number | null;
  createdAt: Date;
}

@Injectable()
export class PrismaStagesRepository
  extends TenantScopedRepository
  implements StagesRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(stage: Stage): Promise<void> {
    await this.prisma.stage.upsert({
      where: { id: stage.id },
      create: {
        id: stage.id,
        tenantId: stage.tenantId,
        festivalId: stage.festivalId,
        name: stage.name,
        order: stage.order,
        advancementQuota: stage.advancementQuota,
        createdAt: stage.createdAt,
      },
      update: {
        name: stage.name,
        order: stage.order,
        advancementQuota: stage.advancementQuota,
      },
    });
  }

  async findById(tenantId: string, id: string): Promise<Stage | null> {
    const row = await this.prisma.stage.findFirst({
      where: this.tenantScoped(tenantId, { id }),
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findAllByFestival(
    tenantId: string,
    festivalId: string,
  ): Promise<Stage[]> {
    const rows = await this.prisma.stage.findMany({
      where: this.tenantScoped(tenantId, { festivalId }),
      orderBy: { order: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: StageRow): Stage {
    const props: StageProps = {
      id: row.id,
      tenantId: row.tenantId,
      festivalId: row.festivalId,
      name: row.name,
      order: row.order,
      advancementQuota: row.advancementQuota,
      createdAt: row.createdAt,
    };
    return Stage.restore(props);
  }
}
```

- [ ] **Step 6: Verify build and lint**

```bash
pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/festivals/domain/stage.entity.ts apps/api/src/festivals/domain/stage.entity.spec.ts apps/api/src/festivals/application/ports/stages-repository.port.ts apps/api/src/festivals/infrastructure/prisma-stages.repository.ts apps/api/src/festivals/infrastructure/in-memory-stages.repository.ts
git commit -m "feat(festivals): add Stage domain entity and repositories"
```

---

### Task 7: `CreateStageUseCase` + `ListStagesUseCase`

**Files:**
- Create: `apps/api/src/festivals/application/use-cases/create-stage.use-case.ts`
- Create: `apps/api/src/festivals/application/use-cases/create-stage.use-case.spec.ts`
- Create: `apps/api/src/festivals/application/use-cases/list-stages.use-case.ts`

**Interfaces:**
- Consumes: `FestivalsRepositoryPort`/`FESTIVALS_REPOSITORY` (Task 3), `StagesRepositoryPort`/`STAGES_REPOSITORY`, `Stage` (Task 6).
- Produces: `CreateStageUseCase.execute(input): Promise<Stage | null>` (`null` = parent festival not found for this tenant), `ListStagesUseCase.execute(tenantId, festivalId): Promise<Stage[] | null>` (`null` = parent festival not found) — consumed by Task 12.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/festivals/application/use-cases/create-stage.use-case.spec.ts`:

```typescript
import { CreateStageUseCase } from './create-stage.use-case';
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';
import { InMemoryStagesRepository } from '../../infrastructure/in-memory-stages.repository';

describe('CreateStageUseCase', () => {
  it('creates a stage under an existing festival', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const stagesRepository = new InMemoryStagesRepository();
    const festival = await new CreateFestivalUseCase(festivalsRepository).execute({
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    });

    const useCase = new CreateStageUseCase(festivalsRepository, stagesRepository);
    const stage = await useCase.execute({
      tenantId: 'tenant-1',
      festivalId: festival.id,
      name: 'Classificatória',
      order: 1,
    });

    expect(stage?.festivalId).toBe(festival.id);
  });

  it('returns null when the festival does not belong to the tenant', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const stagesRepository = new InMemoryStagesRepository();
    const festival = await new CreateFestivalUseCase(festivalsRepository).execute({
      tenantId: 'tenant-1',
      number: 58,
      year: 2026,
      name: 'FENAC 2026',
      registrationBegin: new Date('2026-01-01'),
      registrationEnd: new Date('2026-03-01'),
      inscriptionFee: 25,
    });

    const useCase = new CreateStageUseCase(festivalsRepository, stagesRepository);
    const stage = await useCase.execute({
      tenantId: 'tenant-2',
      festivalId: festival.id,
      name: 'Classificatória',
      order: 1,
    });

    expect(stage).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm test create-stage.use-case.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the use cases**

Create `apps/api/src/festivals/application/use-cases/create-stage.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Stage } from '../../domain/stage.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';
import { STAGES_REPOSITORY } from '../ports/stages-repository.port';
import type { StagesRepositoryPort } from '../ports/stages-repository.port';

export interface CreateStageUseCaseInput {
  tenantId: string;
  festivalId: string;
  name: string;
  order: number;
  advancementQuota?: number | null;
}

@Injectable()
export class CreateStageUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
    @Inject(STAGES_REPOSITORY)
    private readonly stagesRepository: StagesRepositoryPort,
  ) {}

  async execute(input: CreateStageUseCaseInput): Promise<Stage | null> {
    const festival = await this.festivalsRepository.findById(
      input.tenantId,
      input.festivalId,
    );
    if (!festival) return null;

    const stage = Stage.create(input);
    await this.stagesRepository.save(stage);
    return stage;
  }
}
```

Create `apps/api/src/festivals/application/use-cases/list-stages.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Stage } from '../../domain/stage.entity';
import { FESTIVALS_REPOSITORY } from '../ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../ports/festivals-repository.port';
import { STAGES_REPOSITORY } from '../ports/stages-repository.port';
import type { StagesRepositoryPort } from '../ports/stages-repository.port';

@Injectable()
export class ListStagesUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
    @Inject(STAGES_REPOSITORY)
    private readonly stagesRepository: StagesRepositoryPort,
  ) {}

  async execute(tenantId: string, festivalId: string): Promise<Stage[] | null> {
    const festival = await this.festivalsRepository.findById(tenantId, festivalId);
    if (!festival) return null;

    return this.stagesRepository.findAllByFestival(tenantId, festivalId);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm test create-stage.use-case.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify build and lint**

```bash
pnpm run build && pnpm run lint
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/festivals/application/use-cases/create-stage.use-case.ts apps/api/src/festivals/application/use-cases/create-stage.use-case.spec.ts apps/api/src/festivals/application/use-cases/list-stages.use-case.ts
git commit -m "feat(festivals): add Create/ListStage use cases"
```

---

### Task 8: `GradeCriterion` domain entity + repositories

**Files:**
- Create: `apps/api/src/festivals/domain/grade-criterion.entity.ts`
- Create: `apps/api/src/festivals/domain/grade-criterion.entity.spec.ts`
- Create: `apps/api/src/festivals/application/ports/grade-criteria-repository.port.ts`
- Create: `apps/api/src/festivals/infrastructure/prisma-grade-criteria.repository.ts`
- Create: `apps/api/src/festivals/infrastructure/in-memory-grade-criteria.repository.ts`

**Interfaces:**
- Consumes: `TenantScopedRepository`, `PrismaService` (existing).
- Produces: `GradeCriterion` class (`.create`/`.restore`, getters), `GradeCriterionProps`, `GradeCriteriaRepositoryPort` (`save`, `findAllByStage`), `GRADE_CRITERIA_REPOSITORY` Symbol — consumed by Task 9, Task 12.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/festivals/domain/grade-criterion.entity.spec.ts`:

```typescript
import { GradeCriterion } from './grade-criterion.entity';

describe('GradeCriterion', () => {
  it('creates a grade criterion with a positive weight', () => {
    const criterion = GradeCriterion.create({
      tenantId: 'tenant-1',
      stageId: 'stage-1',
      name: 'Afinação',
      weight: 2.5,
    });

    expect(criterion.id).toBeDefined();
    expect(criterion.weight).toBe(2.5);
  });

  it('rejects an empty name', () => {
    expect(() =>
      GradeCriterion.create({
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        name: '',
        weight: 1,
      }),
    ).toThrow('name must not be empty');
  });

  it('rejects a non-positive weight', () => {
    expect(() =>
      GradeCriterion.create({
        tenantId: 'tenant-1',
        stageId: 'stage-1',
        name: 'Interpretação',
        weight: 0,
      }),
    ).toThrow('weight must be greater than zero');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm test grade-criterion.entity.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the entity**

Create `apps/api/src/festivals/domain/grade-criterion.entity.ts`:

```typescript
import { randomUUID } from 'crypto';

export interface GradeCriterionProps {
  id: string;
  tenantId: string;
  stageId: string;
  name: string;
  weight: number;
  createdAt: Date;
}

export interface CreateGradeCriterionInput {
  tenantId: string;
  stageId: string;
  name: string;
  weight: number;
}

export class GradeCriterion {
  private constructor(private readonly props: GradeCriterionProps) {}

  static create(input: CreateGradeCriterionInput): GradeCriterion {
    if (input.name.trim().length === 0) {
      throw new Error('name must not be empty');
    }
    if (input.weight <= 0) {
      throw new Error('weight must be greater than zero');
    }

    return new GradeCriterion({
      id: randomUUID(),
      tenantId: input.tenantId,
      stageId: input.stageId,
      name: input.name,
      weight: input.weight,
      createdAt: new Date(),
    });
  }

  static restore(props: GradeCriterionProps): GradeCriterion {
    return new GradeCriterion(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get stageId(): string {
    return this.props.stageId;
  }
  get name(): string {
    return this.props.name;
  }
  get weight(): number {
    return this.props.weight;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm test grade-criterion.entity.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the port and repositories**

Create `apps/api/src/festivals/application/ports/grade-criteria-repository.port.ts`:

```typescript
import { GradeCriterion } from '../../domain/grade-criterion.entity';

export interface GradeCriteriaRepositoryPort {
  save(criterion: GradeCriterion): Promise<void>;
  findAllByStage(tenantId: string, stageId: string): Promise<GradeCriterion[]>;
}

export const GRADE_CRITERIA_REPOSITORY = Symbol('GRADE_CRITERIA_REPOSITORY');
```

Create `apps/api/src/festivals/infrastructure/in-memory-grade-criteria.repository.ts`:

```typescript
import { GradeCriterion } from '../domain/grade-criterion.entity';
import type { GradeCriteriaRepositoryPort } from '../application/ports/grade-criteria-repository.port';

export class InMemoryGradeCriteriaRepository
  implements GradeCriteriaRepositoryPort
{
  private readonly criteria = new Map<string, GradeCriterion>();

  save(criterion: GradeCriterion): Promise<void> {
    this.criteria.set(criterion.id, criterion);
    return Promise.resolve();
  }

  findAllByStage(
    tenantId: string,
    stageId: string,
  ): Promise<GradeCriterion[]> {
    return Promise.resolve(
      [...this.criteria.values()].filter(
        (c) => c.tenantId === tenantId && c.stageId === stageId,
      ),
    );
  }
}
```

Create `apps/api/src/festivals/infrastructure/prisma-grade-criteria.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { GradeCriterion } from '../domain/grade-criterion.entity';
import type { GradeCriterionProps } from '../domain/grade-criterion.entity';
import type { GradeCriteriaRepositoryPort } from '../application/ports/grade-criteria-repository.port';

interface GradeCriterionRow {
  id: string;
  tenantId: string;
  stageId: string;
  name: string;
  weight: Prisma.Decimal;
  createdAt: Date;
}

@Injectable()
export class PrismaGradeCriteriaRepository
  extends TenantScopedRepository
  implements GradeCriteriaRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(criterion: GradeCriterion): Promise<void> {
    await this.prisma.gradeCriterion.upsert({
      where: { id: criterion.id },
      create: {
        id: criterion.id,
        tenantId: criterion.tenantId,
        stageId: criterion.stageId,
        name: criterion.name,
        weight: criterion.weight,
        createdAt: criterion.createdAt,
      },
      update: {
        name: criterion.name,
        weight: criterion.weight,
      },
    });
  }

  async findAllByStage(
    tenantId: string,
    stageId: string,
  ): Promise<GradeCriterion[]> {
    const rows = await this.prisma.gradeCriterion.findMany({
      where: this.tenantScoped(tenantId, { stageId }),
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: GradeCriterionRow): GradeCriterion {
    const props: GradeCriterionProps = {
      id: row.id,
      tenantId: row.tenantId,
      stageId: row.stageId,
      name: row.name,
      weight: Number(row.weight),
      createdAt: row.createdAt,
    };
    return GradeCriterion.restore(props);
  }
}
```

- [ ] **Step 6: Verify build and lint**

```bash
pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/festivals/domain/grade-criterion.entity.ts apps/api/src/festivals/domain/grade-criterion.entity.spec.ts apps/api/src/festivals/application/ports/grade-criteria-repository.port.ts apps/api/src/festivals/infrastructure/prisma-grade-criteria.repository.ts apps/api/src/festivals/infrastructure/in-memory-grade-criteria.repository.ts
git commit -m "feat(festivals): add GradeCriterion domain entity and repositories"
```

---

### Task 9: `CreateGradeCriterionUseCase` + `ListGradeCriteriaUseCase`

**Files:**
- Create: `apps/api/src/festivals/application/use-cases/create-grade-criterion.use-case.ts`
- Create: `apps/api/src/festivals/application/use-cases/create-grade-criterion.use-case.spec.ts`
- Create: `apps/api/src/festivals/application/use-cases/list-grade-criteria.use-case.ts`

**Interfaces:**
- Consumes: `StagesRepositoryPort`/`STAGES_REPOSITORY` (Task 6), `GradeCriteriaRepositoryPort`/`GRADE_CRITERIA_REPOSITORY`, `GradeCriterion` (Task 8).
- Produces: `CreateGradeCriterionUseCase.execute(input): Promise<GradeCriterion | null>` (`null` = parent stage not found for this tenant), `ListGradeCriteriaUseCase.execute(tenantId, stageId): Promise<GradeCriterion[] | null>` — consumed by Task 12.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/festivals/application/use-cases/create-grade-criterion.use-case.spec.ts`:

```typescript
import { CreateGradeCriterionUseCase } from './create-grade-criterion.use-case';
import { CreateStageUseCase } from './create-stage.use-case';
import { CreateFestivalUseCase } from './create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../infrastructure/in-memory-festivals.repository';
import { InMemoryStagesRepository } from '../../infrastructure/in-memory-stages.repository';
import { InMemoryGradeCriteriaRepository } from '../../infrastructure/in-memory-grade-criteria.repository';

async function seedStage() {
  const festivalsRepository = new InMemoryFestivalsRepository();
  const stagesRepository = new InMemoryStagesRepository();
  const festival = await new CreateFestivalUseCase(festivalsRepository).execute({
    tenantId: 'tenant-1',
    number: 58,
    year: 2026,
    name: 'FENAC 2026',
    registrationBegin: new Date('2026-01-01'),
    registrationEnd: new Date('2026-03-01'),
    inscriptionFee: 25,
  });
  const stage = await new CreateStageUseCase(
    festivalsRepository,
    stagesRepository,
  ).execute({
    tenantId: 'tenant-1',
    festivalId: festival.id,
    name: 'Classificatória',
    order: 1,
  });
  return { stagesRepository, stage: stage! };
}

describe('CreateGradeCriterionUseCase', () => {
  it('creates a grade criterion under an existing stage', async () => {
    const { stagesRepository, stage } = await seedStage();
    const criteriaRepository = new InMemoryGradeCriteriaRepository();

    const useCase = new CreateGradeCriterionUseCase(
      stagesRepository,
      criteriaRepository,
    );
    const criterion = await useCase.execute({
      tenantId: 'tenant-1',
      stageId: stage.id,
      name: 'Afinação',
      weight: 2,
    });

    expect(criterion?.stageId).toBe(stage.id);
  });

  it('returns null when the stage does not belong to the tenant', async () => {
    const { stagesRepository, stage } = await seedStage();
    const criteriaRepository = new InMemoryGradeCriteriaRepository();

    const useCase = new CreateGradeCriterionUseCase(
      stagesRepository,
      criteriaRepository,
    );
    const criterion = await useCase.execute({
      tenantId: 'tenant-2',
      stageId: stage.id,
      name: 'Afinação',
      weight: 2,
    });

    expect(criterion).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && pnpm test create-grade-criterion.use-case.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the use cases**

Create `apps/api/src/festivals/application/use-cases/create-grade-criterion.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { GradeCriterion } from '../../domain/grade-criterion.entity';
import { STAGES_REPOSITORY } from '../ports/stages-repository.port';
import type { StagesRepositoryPort } from '../ports/stages-repository.port';
import { GRADE_CRITERIA_REPOSITORY } from '../ports/grade-criteria-repository.port';
import type { GradeCriteriaRepositoryPort } from '../ports/grade-criteria-repository.port';

export interface CreateGradeCriterionUseCaseInput {
  tenantId: string;
  stageId: string;
  name: string;
  weight: number;
}

@Injectable()
export class CreateGradeCriterionUseCase {
  constructor(
    @Inject(STAGES_REPOSITORY)
    private readonly stagesRepository: StagesRepositoryPort,
    @Inject(GRADE_CRITERIA_REPOSITORY)
    private readonly gradeCriteriaRepository: GradeCriteriaRepositoryPort,
  ) {}

  async execute(
    input: CreateGradeCriterionUseCaseInput,
  ): Promise<GradeCriterion | null> {
    const stage = await this.stagesRepository.findById(
      input.tenantId,
      input.stageId,
    );
    if (!stage) return null;

    const criterion = GradeCriterion.create(input);
    await this.gradeCriteriaRepository.save(criterion);
    return criterion;
  }
}
```

Create `apps/api/src/festivals/application/use-cases/list-grade-criteria.use-case.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { GradeCriterion } from '../../domain/grade-criterion.entity';
import { STAGES_REPOSITORY } from '../ports/stages-repository.port';
import type { StagesRepositoryPort } from '../ports/stages-repository.port';
import { GRADE_CRITERIA_REPOSITORY } from '../ports/grade-criteria-repository.port';
import type { GradeCriteriaRepositoryPort } from '../ports/grade-criteria-repository.port';

@Injectable()
export class ListGradeCriteriaUseCase {
  constructor(
    @Inject(STAGES_REPOSITORY)
    private readonly stagesRepository: StagesRepositoryPort,
    @Inject(GRADE_CRITERIA_REPOSITORY)
    private readonly gradeCriteriaRepository: GradeCriteriaRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    stageId: string,
  ): Promise<GradeCriterion[] | null> {
    const stage = await this.stagesRepository.findById(tenantId, stageId);
    if (!stage) return null;

    return this.gradeCriteriaRepository.findAllByStage(tenantId, stageId);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm test create-grade-criterion.use-case.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify build and lint**

```bash
pnpm run build && pnpm run lint
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/festivals/application/use-cases/create-grade-criterion.use-case.ts apps/api/src/festivals/application/use-cases/create-grade-criterion.use-case.spec.ts apps/api/src/festivals/application/use-cases/list-grade-criteria.use-case.ts
git commit -m "feat(festivals): add Create/ListGradeCriterion use cases"
```

---

### Task 10: `packages/contracts` schemas

**Files:**
- Create: `packages/contracts/src/festival.schema.ts`
- Create: `packages/contracts/src/festival.schema.spec.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces: `createFestivalSchema`/`CreateFestivalDto`, `updateFestivalSchema`/`UpdateFestivalDto`, `createStageSchema`/`CreateStageDto`, `createGradeCriterionSchema`/`CreateGradeCriterionDto`, `BRAZILIAN_STATES` — consumed by Task 12's controller.

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/festival.schema.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  createFestivalSchema,
  updateFestivalSchema,
  createStageSchema,
  createGradeCriterionSchema,
} from './festival.schema';

const validCreate = {
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: '2026-01-01T08:00:00.000Z',
  registrationEnd: '2026-03-01T18:00:00.000Z',
  inscriptionFee: 25,
};

describe('createFestivalSchema', () => {
  it('accepts a valid payload', () => {
    expect(createFestivalSchema.safeParse(validCreate).success).toBe(true);
  });

  it('rejects an invalid Brazilian state', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      allowedStates: ['XX'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative inscriptionFee', () => {
    const result = createFestivalSchema.safeParse({
      ...validCreate,
      inscriptionFee: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateFestivalSchema', () => {
  it('accepts a payload without number/year', () => {
    const { number, year, ...rest } = validCreate;
    expect(updateFestivalSchema.safeParse(rest).success).toBe(true);
  });
});

describe('createStageSchema', () => {
  it('accepts a valid stage payload', () => {
    expect(
      createStageSchema.safeParse({ name: 'Classificatória', order: 1 })
        .success,
    ).toBe(true);
  });

  it('rejects a non-positive order', () => {
    expect(
      createStageSchema.safeParse({ name: 'Final', order: 0 }).success,
    ).toBe(false);
  });
});

describe('createGradeCriterionSchema', () => {
  it('accepts a valid criterion payload', () => {
    expect(
      createGradeCriterionSchema.safeParse({ name: 'Afinação', weight: 2.5 })
        .success,
    ).toBe(true);
  });

  it('rejects a non-positive weight', () => {
    expect(
      createGradeCriterionSchema.safeParse({ name: 'Afinação', weight: 0 })
        .success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/contracts && pnpm exec vitest run festival.schema.spec.ts`
Expected: FAIL — `Cannot find module './festival.schema'`.

- [ ] **Step 3: Implement the schemas**

Create `packages/contracts/src/festival.schema.ts`:

```typescript
import { z } from 'zod';

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;

const festivalDetailsShape = {
  name: z.string().min(1).max(255),
  registrationBegin: z.coerce.date(),
  registrationEnd: z.coerce.date(),
  votingBegin: z.coerce.date().nullable().optional(),
  votingEnd: z.coerce.date().nullable().optional(),
  inscriptionFee: z.number().min(0),
  regulationUrl: z.string().url().nullable().optional(),
  allowedStates: z.array(z.enum(BRAZILIAN_STATES)).optional(),
};

export const createFestivalSchema = z.object({
  number: z.number().int().positive(),
  year: z.number().int().min(1900).max(2200),
  ...festivalDetailsShape,
});

export type CreateFestivalDto = z.infer<typeof createFestivalSchema>;

export const updateFestivalSchema = z.object(festivalDetailsShape);

export type UpdateFestivalDto = z.infer<typeof updateFestivalSchema>;

export const createStageSchema = z.object({
  name: z.string().min(1).max(255),
  order: z.number().int().positive(),
  advancementQuota: z.number().int().positive().nullable().optional(),
});

export type CreateStageDto = z.infer<typeof createStageSchema>;

export const createGradeCriterionSchema = z.object({
  name: z.string().min(1).max(255),
  weight: z.number().positive(),
});

export type CreateGradeCriterionDto = z.infer<typeof createGradeCriterionSchema>;
```

- [ ] **Step 4: Wire the exports**

Add to `packages/contracts/src/index.ts`:

```typescript
export {
  createFestivalSchema,
  updateFestivalSchema,
  createStageSchema,
  createGradeCriterionSchema,
  BRAZILIAN_STATES,
} from './festival.schema.js';
export type {
  CreateFestivalDto,
  UpdateFestivalDto,
  CreateStageDto,
  CreateGradeCriterionDto,
} from './festival.schema.js';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/contracts && pnpm exec vitest run festival.schema.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Verify build and lint**

```bash
cd packages/contracts && pnpm run build && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): add festival/stage/grade-criterion schemas"
```

---

### Task 11: Exception filters — `FestivalConflictError` and `InvalidFestivalStateError` → HTTP

**Files:**
- Create: `apps/api/src/common/filters/festival-conflict.filter.ts`
- Create: `apps/api/src/common/filters/invalid-festival-state.filter.ts`

**Interfaces:**
- Consumes: `FestivalConflictError`, `InvalidFestivalStateError` (Task 2).
- Produces: `FestivalConflictExceptionFilter`, `InvalidFestivalStateExceptionFilter` — consumed by Task 12's controller via `@UseFilters(...)`.

- [ ] **Step 1: Implement the filters**

Create `apps/api/src/common/filters/festival-conflict.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { FestivalConflictError } from '../../festivals/domain/festival-conflict.error';

@Catch(FestivalConflictError)
export class FestivalConflictExceptionFilter implements ExceptionFilter {
  catch(exception: FestivalConflictError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(409).json({
      statusCode: 409,
      message: exception.message,
    });
  }
}
```

Create `apps/api/src/common/filters/invalid-festival-state.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { InvalidFestivalStateError } from '../../festivals/domain/invalid-festival-state.error';

@Catch(InvalidFestivalStateError)
export class InvalidFestivalStateExceptionFilter implements ExceptionFilter {
  catch(exception: InvalidFestivalStateError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(409).json({
      statusCode: 409,
      message: exception.message,
    });
  }
}
```

There is no dedicated unit test for these filters — this matches the existing precedent (`TenantConflictExceptionFilter`, `UserConflictExceptionFilter`, `AdminConflictExceptionFilter` have none either); they are exercised end-to-end by Task 12's e2e tests.

- [ ] **Step 2: Verify build and lint**

```bash
cd apps/api && pnpm run build && pnpm run lint
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/filters/festival-conflict.filter.ts apps/api/src/common/filters/invalid-festival-state.filter.ts
git commit -m "feat(common): add Festival conflict and invalid-state exception filters"
```

---

### Task 12: `FestivalsController` — full CRUD + stages + grade criteria (e2e TDD)

**Files:**
- Create: `apps/api/src/festivals/infrastructure/festivals.controller.ts`
- Create: `apps/api/src/festivals/festivals.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/festivals.e2e-spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-11 — `FindTenantBySlugUseCase` (existing, `tenants` module), `AdminAuthGuard`/`RequestWithAdmin` (existing, `admin-identity` module), `RolesGuard`/`@Roles()`, `AuditLogInterceptor`/`@AuditLog()` (existing, `common`), all Festival/Stage/GradeCriterion use cases (Tasks 4/5/7/9), `FestivalConflictExceptionFilter`/`InvalidFestivalStateExceptionFilter` (Task 11), all `@fenac-platform/contracts` schemas (Task 10).
- Produces: `POST /tenants/:tenantSlug/festivals` (201, ORGANIZER-only, audit-logged) · `GET /tenants/:tenantSlug/festivals` (200, any admin) · `GET /tenants/:tenantSlug/festivals/:festivalId` (200, any admin) · `PATCH /tenants/:tenantSlug/festivals/:festivalId` (200, ORGANIZER-only, audit-logged) · `POST /tenants/:tenantSlug/festivals/:festivalId/publish` (200, ORGANIZER-only, audit-logged) · `POST /tenants/:tenantSlug/festivals/:festivalId/close` (200, ORGANIZER-only, audit-logged) · `POST /tenants/:tenantSlug/festivals/:festivalId/stages` (201, ORGANIZER-only, audit-logged) · `GET /tenants/:tenantSlug/festivals/:festivalId/stages` (200, any admin) · `POST /tenants/:tenantSlug/festivals/stages/:stageId/grade-criteria` (201, ORGANIZER-only, audit-logged) · `GET /tenants/:tenantSlug/festivals/stages/:stageId/grade-criteria` (200, any admin).

- [ ] **Step 1: Write the failing e2e test**

Create `apps/api/test/festivals.e2e-spec.ts`:

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
    expect((listResponse.body as FestivalResponseBody[])).toHaveLength(1);

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
      .post(`/tenants/${tenantSlug}/festivals/stages/${stage.id}/grade-criteria`)
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

  it('rejects a token minted for one tenant when used to list another tenant\'s festivals', async () => {
    const otherToken = await loginAs(otherTenantSlug, otherOrganizerEmail);

    await request(app.getHttpServer())
      .get(`/tenants/${tenantSlug}/festivals`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(401);
  });
});
```

- [ ] **Step 2: Run the e2e test to verify it fails**

Ensure MySQL is up: `docker compose up -d mysql`
Run: `cd apps/api && pnpm run test:e2e festivals.e2e-spec.ts`
Expected: FAIL — 404, no `/tenants/:tenantSlug/festivals*` routes registered yet.

- [ ] **Step 3: Implement the controller**

Create `apps/api/src/festivals/infrastructure/festivals.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  createFestivalSchema,
  updateFestivalSchema,
  createStageSchema,
  createGradeCriterionSchema,
} from '@fenac-platform/contracts';
import type {
  CreateFestivalDto,
  UpdateFestivalDto,
  CreateStageDto,
  CreateGradeCriterionDto,
} from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { FestivalConflictExceptionFilter } from '../../common/filters/festival-conflict.filter';
import { InvalidFestivalStateExceptionFilter } from '../../common/filters/invalid-festival-state.filter';
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import type { Tenant } from '../../tenants/domain/tenant.entity';
import { AdminAuthGuard } from '../../admin-identity/infrastructure/admin-auth.guard';
import type { RequestWithAdmin } from '../../admin-identity/infrastructure/admin-auth.guard';
import { CreateFestivalUseCase } from '../application/use-cases/create-festival.use-case';
import { ListFestivalsUseCase } from '../application/use-cases/list-festivals.use-case';
import { GetFestivalUseCase } from '../application/use-cases/get-festival.use-case';
import { UpdateFestivalDetailsUseCase } from '../application/use-cases/update-festival-details.use-case';
import { PublishFestivalUseCase } from '../application/use-cases/publish-festival.use-case';
import { CloseFestivalUseCase } from '../application/use-cases/close-festival.use-case';
import { CreateStageUseCase } from '../application/use-cases/create-stage.use-case';
import { ListStagesUseCase } from '../application/use-cases/list-stages.use-case';
import { CreateGradeCriterionUseCase } from '../application/use-cases/create-grade-criterion.use-case';
import { ListGradeCriteriaUseCase } from '../application/use-cases/list-grade-criteria.use-case';
import type { Festival } from '../domain/festival.entity';
import type { Stage } from '../domain/stage.entity';
import type { GradeCriterion } from '../domain/grade-criterion.entity';

@Controller('tenants/:tenantSlug/festivals')
@UseGuards(AdminAuthGuard)
@UseFilters(FestivalConflictExceptionFilter, InvalidFestivalStateExceptionFilter)
export class FestivalsController {
  constructor(
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly createFestival: CreateFestivalUseCase,
    private readonly listFestivals: ListFestivalsUseCase,
    private readonly getFestival: GetFestivalUseCase,
    private readonly updateFestivalDetails: UpdateFestivalDetailsUseCase,
    private readonly publishFestival: PublishFestivalUseCase,
    private readonly closeFestival: CloseFestivalUseCase,
    private readonly createStage: CreateStageUseCase,
    private readonly listStages: ListStagesUseCase,
    private readonly createGradeCriterion: CreateGradeCriterionUseCase,
    private readonly listGradeCriteria: ListGradeCriteriaUseCase,
  ) {}

  private async resolveTenantForAdmin(
    tenantSlug: string,
    request: RequestWithAdmin,
  ): Promise<Tenant> {
    const tenant = await this.findTenantBySlug.execute(tenantSlug);
    if (!tenant) throw new NotFoundException('tenant not found');
    if (tenant.id !== request.admin!.tenantId) {
      throw new UnauthorizedException();
    }
    return tenant;
  }

  private toFestivalDto(festival: Festival) {
    return {
      id: festival.id,
      number: festival.number,
      year: festival.year,
      name: festival.name,
      registrationBegin: festival.registrationBegin,
      registrationEnd: festival.registrationEnd,
      votingBegin: festival.votingBegin,
      votingEnd: festival.votingEnd,
      status: festival.status,
      inscriptionFee: festival.inscriptionFee,
      regulationUrl: festival.regulationUrl,
      allowedStates: festival.allowedStates,
    };
  }

  private toStageDto(stage: Stage) {
    return {
      id: stage.id,
      festivalId: stage.festivalId,
      name: stage.name,
      order: stage.order,
      advancementQuota: stage.advancementQuota,
    };
  }

  private toGradeCriterionDto(criterion: GradeCriterion) {
    return {
      id: criterion.id,
      stageId: criterion.stageId,
      name: criterion.name,
      weight: criterion.weight,
    };
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('created_festival', (result: unknown) => ({
    targetType: 'Festival',
    targetId: (result as { id: string }).id,
  }))
  async create(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(createFestivalSchema))
    body: CreateFestivalDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.createFestival.execute({
      tenantId: tenant.id,
      ...body,
    });
    return this.toFestivalDto(festival);
  }

  @Get()
  async list(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festivals = await this.listFestivals.execute(tenant.id);
    return festivals.map((festival) => this.toFestivalDto(festival));
  }

  @Get(':festivalId')
  async get(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.getFestival.execute(tenant.id, festivalId);
    if (!festival) throw new NotFoundException('festival not found');
    return this.toFestivalDto(festival);
  }

  @Patch(':festivalId')
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('updated_festival', (result: unknown) => ({
    targetType: 'Festival',
    targetId: (result as { id: string }).id,
  }))
  async update(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(updateFestivalSchema))
    body: UpdateFestivalDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.updateFestivalDetails.execute({
      tenantId: tenant.id,
      festivalId,
      ...body,
    });
    if (!festival) throw new NotFoundException('festival not found');
    return this.toFestivalDto(festival);
  }

  @Post(':festivalId/publish')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('published_festival', (result: unknown) => ({
    targetType: 'Festival',
    targetId: (result as { id: string }).id,
  }))
  async publish(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.publishFestival.execute(tenant.id, festivalId);
    if (!festival) throw new NotFoundException('festival not found');
    return this.toFestivalDto(festival);
  }

  @Post(':festivalId/close')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('closed_festival', (result: unknown) => ({
    targetType: 'Festival',
    targetId: (result as { id: string }).id,
  }))
  async close(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const festival = await this.closeFestival.execute(tenant.id, festivalId);
    if (!festival) throw new NotFoundException('festival not found');
    return this.toFestivalDto(festival);
  }

  @Post(':festivalId/stages')
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('created_stage', (result: unknown) => ({
    targetType: 'Stage',
    targetId: (result as { id: string }).id,
  }))
  async createFestivalStage(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(createStageSchema)) body: CreateStageDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const stage = await this.createStage.execute({
      tenantId: tenant.id,
      festivalId,
      ...body,
    });
    if (!stage) throw new NotFoundException('festival not found');
    return this.toStageDto(stage);
  }

  @Get(':festivalId/stages')
  async listFestivalStages(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const stages = await this.listStages.execute(tenant.id, festivalId);
    if (!stages) throw new NotFoundException('festival not found');
    return stages.map((stage) => this.toStageDto(stage));
  }

  @Post('stages/:stageId/grade-criteria')
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('created_grade_criterion', (result: unknown) => ({
    targetType: 'GradeCriterion',
    targetId: (result as { id: string }).id,
  }))
  async createStageGradeCriterion(
    @Param('tenantSlug') tenantSlug: string,
    @Param('stageId') stageId: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(createGradeCriterionSchema))
    body: CreateGradeCriterionDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const criterion = await this.createGradeCriterion.execute({
      tenantId: tenant.id,
      stageId,
      ...body,
    });
    if (!criterion) throw new NotFoundException('stage not found');
    return this.toGradeCriterionDto(criterion);
  }

  @Get('stages/:stageId/grade-criteria')
  async listStageGradeCriteria(
    @Param('tenantSlug') tenantSlug: string,
    @Param('stageId') stageId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const criteria = await this.listGradeCriteria.execute(tenant.id, stageId);
    if (!criteria) throw new NotFoundException('stage not found');
    return criteria.map((criterion) => this.toGradeCriterionDto(criterion));
  }
}
```

- [ ] **Step 4: Wire the module**

Create `apps/api/src/festivals/festivals.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminIdentityModule } from '../admin-identity/admin-identity.module';
import { FestivalsController } from './infrastructure/festivals.controller';
import { PrismaFestivalsRepository } from './infrastructure/prisma-festivals.repository';
import { PrismaStagesRepository } from './infrastructure/prisma-stages.repository';
import { PrismaGradeCriteriaRepository } from './infrastructure/prisma-grade-criteria.repository';
import { FESTIVALS_REPOSITORY } from './application/ports/festivals-repository.port';
import { STAGES_REPOSITORY } from './application/ports/stages-repository.port';
import { GRADE_CRITERIA_REPOSITORY } from './application/ports/grade-criteria-repository.port';
import { CreateFestivalUseCase } from './application/use-cases/create-festival.use-case';
import { ListFestivalsUseCase } from './application/use-cases/list-festivals.use-case';
import { GetFestivalUseCase } from './application/use-cases/get-festival.use-case';
import { UpdateFestivalDetailsUseCase } from './application/use-cases/update-festival-details.use-case';
import { PublishFestivalUseCase } from './application/use-cases/publish-festival.use-case';
import { CloseFestivalUseCase } from './application/use-cases/close-festival.use-case';
import { CreateStageUseCase } from './application/use-cases/create-stage.use-case';
import { ListStagesUseCase } from './application/use-cases/list-stages.use-case';
import { CreateGradeCriterionUseCase } from './application/use-cases/create-grade-criterion.use-case';
import { ListGradeCriteriaUseCase } from './application/use-cases/list-grade-criteria.use-case';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';

@Module({
  imports: [TenantsModule, AdminIdentityModule],
  controllers: [FestivalsController],
  providers: [
    CreateFestivalUseCase,
    ListFestivalsUseCase,
    GetFestivalUseCase,
    UpdateFestivalDetailsUseCase,
    PublishFestivalUseCase,
    CloseFestivalUseCase,
    CreateStageUseCase,
    ListStagesUseCase,
    CreateGradeCriterionUseCase,
    ListGradeCriteriaUseCase,
    RolesGuard,
    AuditLogInterceptor,
    { provide: FESTIVALS_REPOSITORY, useClass: PrismaFestivalsRepository },
    { provide: STAGES_REPOSITORY, useClass: PrismaStagesRepository },
    {
      provide: GRADE_CRITERIA_REPOSITORY,
      useClass: PrismaGradeCriteriaRepository,
    },
  ],
})
export class FestivalsModule {}
```

Open `apps/api/src/app.module.ts` and add `FestivalsModule` to its `imports` array:

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { IdentityModule } from './identity/identity.module';
import { AdminIdentityModule } from './admin-identity/admin-identity.module';
import { FestivalsModule } from './festivals/festivals.module';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    IdentityModule,
    AdminIdentityModule,
    FestivalsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 5: Run the e2e test to verify it passes**

Run: `cd apps/api && pnpm run test:e2e festivals.e2e-spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the full test suite**

Run: `cd apps/api && pnpm run test && pnpm run test:integration && pnpm run test:e2e`
Expected: all PASS.
Run: `cd apps/api && pnpm run build`
Expected: exit 0, no TS1272 or other errors.
Run: `cd apps/api && pnpm run lint`
Expected: 0 errors (pre-existing warnings on `app.getHttpServer()` calls are tolerated; no new errors).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/festivals/infrastructure/festivals.controller.ts apps/api/src/festivals/festivals.module.ts apps/api/src/app.module.ts apps/api/test/festivals.e2e-spec.ts
git commit -m "feat(festivals): expose FestivalsController (CRUD + stages + grade criteria)"
```

---

## Self-Review Notes

- **Spec coverage**: architecture spec §6's Festival domain-model changes (`stages` with `advancementQuota`, `gradeCriteria` replacing the ambiguous legacy `festival_grades`) → Tasks 1, 2, 6, 8. Decision 1 (multi-criteria weighted grading, not the legacy's overloaded single field) → Task 8's `GradeCriterion`. Decision 3 (phases with configurable advancement quota) → Task 6's `Stage.advancementQuota`. Decision 6 (geographic restriction as per-festival configuration, not hardcoded) → Task 2's `Festival.allowedStates`. RBAC/audit infrastructure reused, not rebuilt, from `admin-identity`/`common` (Tasks 11, 12). `FestivalCategory`/`FestivalCity`/`Instrument` explicitly deferred to a follow-up plan (see Scope Decision above) — not a gap, a decomposition.
- **Type consistency checked**: `FestivalsRepositoryPort.save/findById/findAllByTenant` (Task 3) match every call site in Tasks 4, 5, 12. `StagesRepositoryPort.save/findById/findAllByFestival` (Task 6) match Tasks 7, 9, 12. `GradeCriteriaRepositoryPort.save/findAllByStage` (Task 8) match Tasks 9, 12. `Festival`/`Stage`/`GradeCriterion` getters used in `festivals.controller.ts`'s DTO mappers match each entity's actual getter names exactly. `RequestWithAdmin`, `AdminAuthGuard`, `RolesGuard`, `@Roles()`, `AuditLogInterceptor`, `@AuditLog()`, `FindTenantBySlugUseCase`, `ZodValidationPipe` are all reused with their existing, already-shipped signatures — none redefined.
- **No placeholders**: every step shows full file contents or an exact runnable command with expected output; no "add error handling" or "similar to Task N" shortcuts. Every child-resource use case (`CreateStageUseCase`, `CreateGradeCriterionUseCase`, and their `List` counterparts) explicitly re-validates that its parent (festival → stage) belongs to the requesting tenant before acting — the same class of tenant-isolation discipline the previous plan's final review scrutinized heavily, applied here from the start rather than retrofitted.
