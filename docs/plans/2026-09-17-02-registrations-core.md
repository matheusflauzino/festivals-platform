# Registrations Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Inscrições" core: a `Registration` (participant + song submitted to a festival) domain in the backend, and an admin-facing list + "Nova Inscrição" creation modal in the frontend.

**Architecture:** A new backend bounded context `apps/api/src/registrations/` (domain/application/infrastructure), following the exact structural pattern of `apps/api/src/festivals/` — entity with a static `create`/`restore` factory, use-cases injecting repository ports by token, a Prisma repository, an in-memory repository for unit tests, a controller with Zod-validated bodies and domain-error exception filters. A new cross-aggregate rule (`Festival.isAcceptingRegistrations`) gates creation. On the frontend, a new `/inscricoes` page reusing the existing `DataTable`/`FormModal`/`Card` component library exactly as `festival-list.tsx`/`create-stage-form.tsx` already do.

**Tech Stack:** NestJS 11, Prisma 6 (MySQL), Zod 4, Jest (backend), Next.js 16 / React 19, Vitest + Testing Library (frontend), TanStack Query, react-hook-form.

**Spec:** `docs/specs/2026-09-17-registrations-core-design.md` (and the still-valid architectural conventions documented informally in `apps/api/src/festivals/` itself, which this plan replicates file-by-file).

## Global Constraints

- No participant self-service registration in this slice — the admin creates registrations on a participant's behalf. Registration stores participant contact fields directly (`participantName`/`participantEmail`/`participantCpf`), no FK to `User`.
- No unique constraint on `(festivalId, participantCpf)` — the same participant may submit multiple songs to the same festival.
- A registration can only be created while `Festival.status === 'OPEN'` **and** the current time is within `[registrationBegin, registrationEnd]` — enforced server-side via `Festival.isAcceptingRegistrations(now)`, never trust client-side filtering alone.
- All new/changed UI text is Portuguese (pt-BR).
- No new npm dependencies.
- Follow the exact architectural conventions already established in `apps/api/src/festivals/` (entity factory pattern, repository port + token injection, `TenantScopedRepository`, `ZodValidationPipe`, `@Roles`/`RolesGuard`, one exception filter per domain error type, `save()` as `upsert`). Do not introduce a different pattern.
- All commands assume the working directory noted at the top of each step (`apps/api` for backend, `apps/web` for frontend) unless stated otherwise.

---

## Task 1: Prisma schema — `Registration` model + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: MySQL table `registrations` with columns matching `RegistrationProps` (Task 3) — `id`, `tenant_id`, `festival_id`, `participant_name`, `participant_email`, `participant_cpf`, `song_name`, `performers` (TEXT), `music_composer` (nullable), `lyrics_composer` (nullable), `video_url` (nullable), `created_at`, `updated_at`.

- [ ] **Step 1: Add the `Registration` model and the reverse relation on `Festival`**

In `apps/api/prisma/schema.prisma`, add `registrations Registration[]` to the `Festival` model (alongside the existing `stages Stage[]` line), and add this new model (place it after `GradeCriterion`, following the existing model order):

```prisma
model Registration {
  id               String   @id @default(uuid())
  tenantId         String   @map("tenant_id")
  festivalId       String   @map("festival_id")
  festival         Festival @relation(fields: [festivalId], references: [id])
  participantName  String   @map("participant_name")
  participantEmail String   @map("participant_email")
  participantCpf   String   @map("participant_cpf")
  songName         String   @map("song_name")
  performers       String   @db.Text
  musicComposer    String?  @map("music_composer")
  lyricsComposer   String?  @map("lyrics_composer")
  videoUrl         String?  @map("video_url")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@map("registrations")
}
```

- [ ] **Step 2: Generate and apply the migration**

Run (repo root's `.env` already has `DATABASE_URL` pointing at the docker-compose MySQL on `localhost:3307`, which must be running — `docker compose ps` should show `mysql` healthy):

```bash
cd apps/api && pnpm exec prisma migrate dev --name add_registrations
```

Expected: Prisma prints a new migration folder under `apps/api/prisma/migrations/<timestamp>_add_registrations/` containing the `CREATE TABLE registrations (...)` + `ALTER TABLE registrations ADD CONSTRAINT ... FOREIGN KEY (festival_id) REFERENCES festivals(id)` SQL, applies it, and regenerates the Prisma Client (so `prisma.registration` becomes available on `PrismaService` afterward).

- [ ] **Step 3: Verify the Prisma Client picked up the new model**

Run: `cd apps/api && node -e "const {PrismaClient}=require('@prisma/client'); console.log(typeof new PrismaClient().registration)"`
Expected: prints `object` (confirms `prisma.registration.*` methods exist).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add Registration table"
```

---

## Task 2: Shared contract — `createRegistrationSchema`

**Files:**
- Create: `packages/contracts/src/registration.schema.ts`
- Create: `packages/contracts/src/registration.schema.spec.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces: `createRegistrationSchema` (Zod), `CreateRegistrationDto` (inferred type) — consumed by Task 6 (use-case), Task 10 (controller body validation), Task 12 (frontend API client), Task 14 (frontend form).

- [ ] **Step 1: Write the failing test**

```ts
// packages/contracts/src/registration.schema.spec.ts
import { describe, expect, it } from 'vitest';
import { createRegistrationSchema } from './registration.schema';

const validPayload = {
  participantName: 'Mai Sato',
  participantEmail: 'mai.sato@example.com',
  participantCpf: '86359899531',
  songName: 'Chora Menino',
  performers: 'Mai Sato: Canto e Harpa',
};

describe('createRegistrationSchema', () => {
  it('accepts a valid minimal payload', () => {
    expect(createRegistrationSchema.safeParse(validPayload).success).toBe(true);
  });

  it('accepts optional fields when present', () => {
    const result = createRegistrationSchema.safeParse({
      ...validPayload,
      musicComposer: 'Mai Sato',
      lyricsComposer: 'Mai Sato',
      videoUrl: 'https://youtube.com/watch?v=abc123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a CPF that is not exactly 11 digits', () => {
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, participantCpf: '123' }).success,
    ).toBe(false);
  });

  it('rejects an invalid e-mail', () => {
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, participantEmail: 'not-an-email' })
        .success,
    ).toBe(false);
  });

  it('rejects a whitespace-only participantName', () => {
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, participantName: '   ' }).success,
    ).toBe(false);
  });

  it('rejects a whitespace-only songName', () => {
    expect(createRegistrationSchema.safeParse({ ...validPayload, songName: '   ' }).success).toBe(
      false,
    );
  });

  it('rejects an invalid videoUrl', () => {
    expect(
      createRegistrationSchema.safeParse({ ...validPayload, videoUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('accepts a null videoUrl', () => {
    expect(createRegistrationSchema.safeParse({ ...validPayload, videoUrl: null }).success).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd packages/contracts && pnpm vitest run src/registration.schema.spec.ts`
Expected: FAIL — `Cannot find module './registration.schema'`.

- [ ] **Step 3: Implement the schema**

```ts
// packages/contracts/src/registration.schema.ts
import { z } from 'zod';

export const createRegistrationSchema = z.object({
  participantName: z.string().trim().min(1).max(255),
  participantEmail: z.string().email().max(255),
  participantCpf: z.string().regex(/^\d{11}$/, 'cpf must be exactly 11 digits'),
  songName: z.string().trim().min(1).max(255),
  performers: z.string().trim().min(1).max(2000),
  musicComposer: z.string().trim().max(255).nullable().optional(),
  lyricsComposer: z.string().trim().max(255).nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
});

export type CreateRegistrationDto = z.infer<typeof createRegistrationSchema>;
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd packages/contracts && pnpm vitest run src/registration.schema.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Export from the package barrel**

```ts
// packages/contracts/src/index.ts — append at the end
export { createRegistrationSchema } from './registration.schema.js';
export type { CreateRegistrationDto } from './registration.schema.js';
```

- [ ] **Step 6: Rebuild the package so `apps/api`/`apps/web` see the new export**

Run: `pnpm --filter @fenac-platform/contracts build`
Expected: succeeds, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/registration.schema.ts packages/contracts/src/registration.schema.spec.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add createRegistrationSchema"
```

---

## Task 3: `Registration` domain entity

**Files:**
- Create: `apps/api/src/registrations/domain/registration.entity.ts`
- Create: `apps/api/src/registrations/domain/registration.entity.spec.ts`
- Create: `apps/api/src/registrations/domain/registration-validation.error.ts`

**Interfaces:**
- Produces: `Registration` class (`create(input: CreateRegistrationInput)`, `restore(props: RegistrationProps)`, getters for every prop), `RegistrationValidationError`. Consumed by Task 6 (use-case), Task 8 (in-memory repo), Task 9 (Prisma repo).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/registrations/domain/registration.entity.spec.ts
import { Registration } from './registration.entity';
import { RegistrationValidationError } from './registration-validation.error';

const baseInput = {
  tenantId: 'tenant-1',
  festivalId: 'festival-1',
  participantName: 'Mai Sato',
  participantEmail: 'mai.sato@example.com',
  participantCpf: '86359899531',
  songName: 'Chora Menino',
  performers: 'Mai Sato: Canto e Harpa',
};

describe('Registration', () => {
  it('creates a registration with the given props', () => {
    const registration = Registration.create(baseInput);

    expect(registration.id).toBeDefined();
    expect(registration.tenantId).toBe('tenant-1');
    expect(registration.festivalId).toBe('festival-1');
    expect(registration.participantName).toBe('Mai Sato');
    expect(registration.songName).toBe('Chora Menino');
    expect(registration.musicComposer).toBeNull();
    expect(registration.lyricsComposer).toBeNull();
    expect(registration.videoUrl).toBeNull();
    expect(registration.createdAt).toBeInstanceOf(Date);
  });

  it('accepts the optional fields when provided', () => {
    const registration = Registration.create({
      ...baseInput,
      musicComposer: 'Mai Sato',
      lyricsComposer: 'Mai Sato',
      videoUrl: 'https://youtube.com/watch?v=abc123',
    });

    expect(registration.musicComposer).toBe('Mai Sato');
    expect(registration.lyricsComposer).toBe('Mai Sato');
    expect(registration.videoUrl).toBe('https://youtube.com/watch?v=abc123');
  });

  it('rejects a whitespace-only participantName', () => {
    expect(() =>
      Registration.create({ ...baseInput, participantName: '   ' }),
    ).toThrow(RegistrationValidationError);
  });

  it('rejects a whitespace-only songName', () => {
    expect(() => Registration.create({ ...baseInput, songName: '   ' })).toThrow(
      RegistrationValidationError,
    );
  });

  it('rejects a whitespace-only performers', () => {
    expect(() => Registration.create({ ...baseInput, performers: '   ' })).toThrow(
      RegistrationValidationError,
    );
  });

  it('rejects a participantCpf that is not exactly 11 digits', () => {
    expect(() =>
      Registration.create({ ...baseInput, participantCpf: '123' }),
    ).toThrow('participantCpf must be exactly 11 digits');
  });

  it('restores a registration from persisted props without re-validating', () => {
    const restored = Registration.restore({
      id: 'reg-1',
      tenantId: 'tenant-1',
      festivalId: 'festival-1',
      participantName: 'Mai Sato',
      participantEmail: 'mai.sato@example.com',
      participantCpf: '86359899531',
      songName: 'Chora Menino',
      performers: 'Mai Sato: Canto e Harpa',
      musicComposer: null,
      lyricsComposer: null,
      videoUrl: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(restored.id).toBe('reg-1');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/api && pnpm test -- registration.entity.spec.ts`
Expected: FAIL — `Cannot find module './registration.entity'`.

- [ ] **Step 3: Implement the error class**

```ts
// apps/api/src/registrations/domain/registration-validation.error.ts
export class RegistrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistrationValidationError';
  }
}
```

- [ ] **Step 4: Implement the entity**

```ts
// apps/api/src/registrations/domain/registration.entity.ts
import { randomUUID } from 'crypto';
import { RegistrationValidationError } from './registration-validation.error';

export interface RegistrationProps {
  id: string;
  tenantId: string;
  festivalId: string;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer: string | null;
  lyricsComposer: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRegistrationInput {
  tenantId: string;
  festivalId: string;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer?: string | null;
  lyricsComposer?: string | null;
  videoUrl?: string | null;
}

export class Registration {
  private constructor(private readonly props: RegistrationProps) {}

  static create(input: CreateRegistrationInput): Registration {
    if (input.participantName.trim().length === 0) {
      throw new RegistrationValidationError('participantName must not be empty');
    }
    if (!/^\d{11}$/.test(input.participantCpf)) {
      throw new RegistrationValidationError('participantCpf must be exactly 11 digits');
    }
    if (input.songName.trim().length === 0) {
      throw new RegistrationValidationError('songName must not be empty');
    }
    if (input.performers.trim().length === 0) {
      throw new RegistrationValidationError('performers must not be empty');
    }

    const now = new Date();
    return new Registration({
      id: randomUUID(),
      tenantId: input.tenantId,
      festivalId: input.festivalId,
      participantName: input.participantName,
      participantEmail: input.participantEmail,
      participantCpf: input.participantCpf,
      songName: input.songName,
      performers: input.performers,
      musicComposer: input.musicComposer ?? null,
      lyricsComposer: input.lyricsComposer ?? null,
      videoUrl: input.videoUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: RegistrationProps): Registration {
    return new Registration(props);
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
  get participantName(): string {
    return this.props.participantName;
  }
  get participantEmail(): string {
    return this.props.participantEmail;
  }
  get participantCpf(): string {
    return this.props.participantCpf;
  }
  get songName(): string {
    return this.props.songName;
  }
  get performers(): string {
    return this.props.performers;
  }
  get musicComposer(): string | null {
    return this.props.musicComposer;
  }
  get lyricsComposer(): string | null {
    return this.props.lyricsComposer;
  }
  get videoUrl(): string | null {
    return this.props.videoUrl;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd apps/api && pnpm test -- registration.entity.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/registrations/domain
git commit -m "feat(api): add Registration domain entity"
```

---

## Task 4: `Festival.isAcceptingRegistrations` — cross-aggregate business rule

**Files:**
- Modify: `apps/api/src/festivals/domain/festival.entity.ts`
- Modify: `apps/api/src/festivals/domain/festival.entity.spec.ts`

**Interfaces:**
- Produces: `Festival.isAcceptingRegistrations(now: Date): boolean` — consumed by Task 6 (`CreateRegistrationUseCase`).

- [ ] **Step 1: Add failing tests (append to the existing `describe('Festival', ...)` block, after the last existing `it(...)`, right before the closing `});`)**

```ts
  it('accepts registrations when OPEN and within the registration window', () => {
    const festival = Festival.create(baseInput).publish();
    const now = new Date('2026-02-01T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(true);
  });

  it('does not accept registrations when still DRAFT', () => {
    const festival = Festival.create(baseInput);
    const now = new Date('2026-02-01T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(false);
  });

  it('does not accept registrations when CLOSED', () => {
    const festival = Festival.create(baseInput).publish().close();
    const now = new Date('2026-02-01T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(false);
  });

  it('does not accept registrations before registrationBegin', () => {
    const festival = Festival.create(baseInput).publish();
    const now = new Date('2025-12-31T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(false);
  });

  it('does not accept registrations after registrationEnd', () => {
    const festival = Festival.create(baseInput).publish();
    const now = new Date('2026-03-02T00:00:00Z');
    expect(festival.isAcceptingRegistrations(now)).toBe(false);
  });
```

(`baseInput` already has `registrationBegin: new Date('2026-01-01T08:00:00Z')` / `registrationEnd: new Date('2026-03-01T18:00:00Z')` — reuse it, don't redefine it.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/api && pnpm test -- festival.entity.spec.ts`
Expected: FAIL — `festival.isAcceptingRegistrations is not a function`.

- [ ] **Step 3: Add the method to the entity**

In `apps/api/src/festivals/domain/festival.entity.ts`, add this method to the `Festival` class (place it after `close()`, before the getters):

```ts
  isAcceptingRegistrations(now: Date): boolean {
    return (
      this.props.status === 'OPEN' &&
      now.getTime() >= this.props.registrationBegin.getTime() &&
      now.getTime() <= this.props.registrationEnd.getTime()
    );
  }
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/api && pnpm test -- festival.entity.spec.ts`
Expected: PASS (all tests, including the 5 new ones).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/festivals/domain/festival.entity.ts apps/api/src/festivals/domain/festival.entity.spec.ts
git commit -m "feat(api): add Festival.isAcceptingRegistrations"
```

---

## Task 5: `RegistrationsRepositoryPort` + `InMemoryRegistrationsRepository`

**Files:**
- Create: `apps/api/src/registrations/application/ports/registrations-repository.port.ts`
- Create: `apps/api/src/registrations/infrastructure/in-memory-registrations.repository.ts`

**Interfaces:**
- Produces: `RegistrationsRepositoryPort` (`save`, `findAllByTenant`, `findAllByFestival`), `REGISTRATIONS_REPOSITORY` token, `InMemoryRegistrationsRepository`. Consumed by Task 6 (use-cases, via the in-memory repo in tests) and Task 9 (Prisma repo implements the same port).

- [ ] **Step 1: Implement the port**

```ts
// apps/api/src/registrations/application/ports/registrations-repository.port.ts
import { Registration } from '../../domain/registration.entity';

export interface RegistrationsRepositoryPort {
  save(registration: Registration): Promise<void>;
  findAllByTenant(tenantId: string): Promise<Registration[]>;
  findAllByFestival(tenantId: string, festivalId: string): Promise<Registration[]>;
}

export const REGISTRATIONS_REPOSITORY = Symbol('REGISTRATIONS_REPOSITORY');
```

- [ ] **Step 2: Implement the in-memory repository**

```ts
// apps/api/src/registrations/infrastructure/in-memory-registrations.repository.ts
import { Registration } from '../domain/registration.entity';
import type { RegistrationsRepositoryPort } from '../application/ports/registrations-repository.port';

export class InMemoryRegistrationsRepository implements RegistrationsRepositoryPort {
  private readonly registrations = new Map<string, Registration>();

  save(registration: Registration): Promise<void> {
    this.registrations.set(registration.id, registration);
    return Promise.resolve();
  }

  findAllByTenant(tenantId: string): Promise<Registration[]> {
    return Promise.resolve(
      [...this.registrations.values()].filter((r) => r.tenantId === tenantId),
    );
  }

  findAllByFestival(tenantId: string, festivalId: string): Promise<Registration[]> {
    return Promise.resolve(
      [...this.registrations.values()].filter(
        (r) => r.tenantId === tenantId && r.festivalId === festivalId,
      ),
    );
  }
}
```

- [ ] **Step 3: Verify it compiles (no dedicated test for this file — it has no logic of its own beyond what Task 6's use-case tests already exercise)**

Run: `cd apps/api && pnpm exec tsc --noEmit -p .`
Expected: no new errors from these two files (pre-existing unrelated errors, if any, are not this task's concern).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/registrations/application/ports apps/api/src/registrations/infrastructure/in-memory-registrations.repository.ts
git commit -m "feat(api): add RegistrationsRepositoryPort and in-memory implementation"
```

---

## Task 6: `CreateRegistrationUseCase`, `ListRegistrationsUseCase`, `ListFestivalRegistrationsUseCase`

**Files:**
- Create: `apps/api/src/registrations/application/use-cases/create-registration.use-case.ts`
- Create: `apps/api/src/registrations/application/use-cases/create-registration.use-case.spec.ts`
- Create: `apps/api/src/registrations/application/use-cases/list-registrations.use-case.ts`
- Create: `apps/api/src/registrations/application/use-cases/list-festival-registrations.use-case.ts`

**Interfaces:**
- Consumes: `FESTIVALS_REPOSITORY`/`FestivalsRepositoryPort` (Task 4's `isAcceptingRegistrations`), `REGISTRATIONS_REPOSITORY`/`RegistrationsRepositoryPort` (Task 5), `Registration.create` (Task 3), `InvalidFestivalStateError` (existing, `apps/api/src/festivals/domain/invalid-festival-state.error.ts`).
- Produces: `CreateRegistrationUseCase.execute(input): Promise<Registration | null>` (throws `InvalidFestivalStateError` if the festival isn't accepting registrations), `ListRegistrationsUseCase.execute(tenantId): Promise<Registration[]>`, `ListFestivalRegistrationsUseCase.execute(tenantId, festivalId): Promise<Registration[] | null>`. Consumed by Task 10 (controller).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/registrations/application/use-cases/create-registration.use-case.spec.ts
import { CreateRegistrationUseCase } from './create-registration.use-case';
import { CreateFestivalUseCase } from '../../../festivals/application/use-cases/create-festival.use-case';
import { InMemoryFestivalsRepository } from '../../../festivals/infrastructure/in-memory-festivals.repository';
import { InMemoryRegistrationsRepository } from '../../infrastructure/in-memory-registrations.repository';
import { InvalidFestivalStateError } from '../../../festivals/domain/invalid-festival-state.error';

const baseFestivalInput = {
  tenantId: 'tenant-1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: new Date('2026-01-01T00:00:00Z'),
  registrationEnd: new Date('2026-03-01T00:00:00Z'),
  inscriptionFee: 25,
};

const baseRegistrationInput = {
  tenantId: 'tenant-1',
  participantName: 'Mai Sato',
  participantEmail: 'mai.sato@example.com',
  participantCpf: '86359899531',
  songName: 'Chora Menino',
  performers: 'Mai Sato: Canto e Harpa',
};

describe('CreateRegistrationUseCase', () => {
  it('creates a registration when the festival is OPEN and within the registration window', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const registrationsRepository = new InMemoryRegistrationsRepository();
    const festival = (
      await new CreateFestivalUseCase(festivalsRepository).execute(baseFestivalInput)
    ).publish();
    await festivalsRepository.save(festival);

    const useCase = new CreateRegistrationUseCase(festivalsRepository, registrationsRepository);
    const registration = await useCase.execute({
      ...baseRegistrationInput,
      festivalId: festival.id,
    });

    expect(registration?.festivalId).toBe(festival.id);
    expect(registration?.participantName).toBe('Mai Sato');
  });

  it('returns null when the festival does not belong to the tenant', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const registrationsRepository = new InMemoryRegistrationsRepository();
    const festival = (
      await new CreateFestivalUseCase(festivalsRepository).execute(baseFestivalInput)
    ).publish();
    await festivalsRepository.save(festival);

    const useCase = new CreateRegistrationUseCase(festivalsRepository, registrationsRepository);
    const registration = await useCase.execute({
      ...baseRegistrationInput,
      tenantId: 'tenant-2',
      festivalId: festival.id,
    });

    expect(registration).toBeNull();
  });

  it('rejects when the festival is still DRAFT', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const registrationsRepository = new InMemoryRegistrationsRepository();
    const festival = await new CreateFestivalUseCase(festivalsRepository).execute(
      baseFestivalInput,
    );

    const useCase = new CreateRegistrationUseCase(festivalsRepository, registrationsRepository);
    await expect(
      useCase.execute({ ...baseRegistrationInput, festivalId: festival.id }),
    ).rejects.toThrow(InvalidFestivalStateError);
  });

  it('rejects when the festival is CLOSED', async () => {
    const festivalsRepository = new InMemoryFestivalsRepository();
    const registrationsRepository = new InMemoryRegistrationsRepository();
    const festival = (
      await new CreateFestivalUseCase(festivalsRepository).execute(baseFestivalInput)
    )
      .publish()
      .close();
    await festivalsRepository.save(festival);

    const useCase = new CreateRegistrationUseCase(festivalsRepository, registrationsRepository);
    await expect(
      useCase.execute({ ...baseRegistrationInput, festivalId: festival.id }),
    ).rejects.toThrow(InvalidFestivalStateError);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/api && pnpm test -- create-registration.use-case.spec.ts`
Expected: FAIL — `Cannot find module './create-registration.use-case'`.

- [ ] **Step 3: Implement `CreateRegistrationUseCase`**

```ts
// apps/api/src/registrations/application/use-cases/create-registration.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { Registration } from '../../domain/registration.entity';
import { InvalidFestivalStateError } from '../../../festivals/domain/invalid-festival-state.error';
import { FESTIVALS_REPOSITORY } from '../../../festivals/application/ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../../../festivals/application/ports/festivals-repository.port';
import { REGISTRATIONS_REPOSITORY } from '../ports/registrations-repository.port';
import type { RegistrationsRepositoryPort } from '../ports/registrations-repository.port';

export interface CreateRegistrationUseCaseInput {
  tenantId: string;
  festivalId: string;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer?: string | null;
  lyricsComposer?: string | null;
  videoUrl?: string | null;
}

@Injectable()
export class CreateRegistrationUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
    @Inject(REGISTRATIONS_REPOSITORY)
    private readonly registrationsRepository: RegistrationsRepositoryPort,
  ) {}

  async execute(input: CreateRegistrationUseCaseInput): Promise<Registration | null> {
    const festival = await this.festivalsRepository.findById(input.tenantId, input.festivalId);
    if (!festival) return null;

    if (!festival.isAcceptingRegistrations(new Date())) {
      throw new InvalidFestivalStateError('festival is not currently accepting registrations');
    }

    const registration = Registration.create(input);
    await this.registrationsRepository.save(registration);
    return registration;
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd apps/api && pnpm test -- create-registration.use-case.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the two list use-cases (no dedicated spec — matches the existing `list-stages`/`list-festivals` convention of no unit test, covered by the e2e test in Task 11)**

```ts
// apps/api/src/registrations/application/use-cases/list-registrations.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { Registration } from '../../domain/registration.entity';
import { REGISTRATIONS_REPOSITORY } from '../ports/registrations-repository.port';
import type { RegistrationsRepositoryPort } from '../ports/registrations-repository.port';

@Injectable()
export class ListRegistrationsUseCase {
  constructor(
    @Inject(REGISTRATIONS_REPOSITORY)
    private readonly registrationsRepository: RegistrationsRepositoryPort,
  ) {}

  async execute(tenantId: string): Promise<Registration[]> {
    return this.registrationsRepository.findAllByTenant(tenantId);
  }
}
```

```ts
// apps/api/src/registrations/application/use-cases/list-festival-registrations.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { Registration } from '../../domain/registration.entity';
import { FESTIVALS_REPOSITORY } from '../../../festivals/application/ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../../../festivals/application/ports/festivals-repository.port';
import { REGISTRATIONS_REPOSITORY } from '../ports/registrations-repository.port';
import type { RegistrationsRepositoryPort } from '../ports/registrations-repository.port';

@Injectable()
export class ListFestivalRegistrationsUseCase {
  constructor(
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
    @Inject(REGISTRATIONS_REPOSITORY)
    private readonly registrationsRepository: RegistrationsRepositoryPort,
  ) {}

  async execute(tenantId: string, festivalId: string): Promise<Registration[] | null> {
    const festival = await this.festivalsRepository.findById(tenantId, festivalId);
    if (!festival) return null;

    return this.registrationsRepository.findAllByFestival(tenantId, festivalId);
  }
}
```

- [ ] **Step 6: Run the whole backend suite**

Run: `cd apps/api && pnpm test`
Expected: all pass, including the pre-existing festivals tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/registrations/application/use-cases
git commit -m "feat(api): add CreateRegistrationUseCase, ListRegistrationsUseCase, ListFestivalRegistrationsUseCase"
```

---

## Task 7: `RegistrationValidationExceptionFilter`

**Files:**
- Create: `apps/api/src/common/filters/registration-validation.filter.ts`

**Interfaces:**
- Consumes: `RegistrationValidationError` (Task 3).
- Produces: an `@Catch(RegistrationValidationError)` filter mapping to HTTP 400. Consumed by Task 10 (controller `@UseFilters`).

- [ ] **Step 1: Implement the filter (mirrors `festival-validation.filter.ts` exactly — no dedicated test, exception filters in this repo aren't unit-tested; Task 11's e2e test exercises it)**

```ts
// apps/api/src/common/filters/registration-validation.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { RegistrationValidationError } from '../../registrations/domain/registration-validation.error';

@Catch(RegistrationValidationError)
export class RegistrationValidationExceptionFilter implements ExceptionFilter {
  catch(exception: RegistrationValidationError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(400).json({
      statusCode: 400,
      message: exception.message,
    });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/api && pnpm exec tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/filters/registration-validation.filter.ts
git commit -m "feat(api): add RegistrationValidationExceptionFilter"
```

---

## Task 8: Export `FESTIVALS_REPOSITORY` from `FestivalsModule`

**Files:**
- Modify: `apps/api/src/festivals/festivals.module.ts`

**Interfaces:**
- Produces: `FestivalsModule` now exports the `FESTIVALS_REPOSITORY` provider token, so other modules that `imports: [FestivalsModule]` can inject `FestivalsRepositoryPort`. Consumed by Task 10 (`RegistrationsModule`/`RegistrationsController` need read access to festival data for the "list all registrations" DTO join and for `CreateRegistrationUseCase`).

- [ ] **Step 1: Add the `exports` array**

In `apps/api/src/festivals/festivals.module.ts`, add an `exports` property to the `@Module({...})` decorator, right after `providers: [...]`:

```ts
  exports: [FESTIVALS_REPOSITORY],
```

The full decorator should now read:

```ts
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
  exports: [FESTIVALS_REPOSITORY],
})
export class FestivalsModule {}
```

Do not change anything else in this file — `FESTIVALS_REPOSITORY` is already imported at the top.

- [ ] **Step 2: Run the full backend suite to confirm this doesn't break anything**

Run: `cd apps/api && pnpm test`
Expected: all pass (adding an export is additive and doesn't change existing behavior).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/festivals/festivals.module.ts
git commit -m "feat(api): export FESTIVALS_REPOSITORY from FestivalsModule"
```

---

## Task 9: `PrismaRegistrationsRepository`

**Files:**
- Create: `apps/api/src/registrations/infrastructure/prisma-registrations.repository.ts`

**Interfaces:**
- Consumes: `PrismaService` (existing), `TenantScopedRepository` (existing, `apps/api/src/common/repositories/tenant-scoped.repository.ts`), `Registration`/`RegistrationProps` (Task 3), `RegistrationsRepositoryPort` (Task 5).
- Produces: `PrismaRegistrationsRepository implements RegistrationsRepositoryPort`. Consumed by Task 10 (`RegistrationsModule`'s provider registration).

- [ ] **Step 1: Implement the repository (mirrors `prisma-stages.repository.ts` exactly — no dedicated unit test; Prisma repositories in this codebase aren't unit-tested in isolation, only exercised via the e2e test in Task 11)**

```ts
// apps/api/src/registrations/infrastructure/prisma-registrations.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedRepository } from '../../common/repositories/tenant-scoped.repository';
import { Registration } from '../domain/registration.entity';
import type { RegistrationProps } from '../domain/registration.entity';
import type { RegistrationsRepositoryPort } from '../application/ports/registrations-repository.port';

interface RegistrationRow {
  id: string;
  tenantId: string;
  festivalId: string;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer: string | null;
  lyricsComposer: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaRegistrationsRepository
  extends TenantScopedRepository
  implements RegistrationsRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async save(registration: Registration): Promise<void> {
    await this.prisma.registration.upsert({
      where: { id: registration.id },
      create: {
        id: registration.id,
        tenantId: registration.tenantId,
        festivalId: registration.festivalId,
        participantName: registration.participantName,
        participantEmail: registration.participantEmail,
        participantCpf: registration.participantCpf,
        songName: registration.songName,
        performers: registration.performers,
        musicComposer: registration.musicComposer,
        lyricsComposer: registration.lyricsComposer,
        videoUrl: registration.videoUrl,
        createdAt: registration.createdAt,
      },
      update: {
        participantName: registration.participantName,
        participantEmail: registration.participantEmail,
        participantCpf: registration.participantCpf,
        songName: registration.songName,
        performers: registration.performers,
        musicComposer: registration.musicComposer,
        lyricsComposer: registration.lyricsComposer,
        videoUrl: registration.videoUrl,
      },
    });
  }

  async findAllByTenant(tenantId: string): Promise<Registration[]> {
    const rows = await this.prisma.registration.findMany({
      where: this.tenantScoped(tenantId),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findAllByFestival(tenantId: string, festivalId: string): Promise<Registration[]> {
    const rows = await this.prisma.registration.findMany({
      where: this.tenantScoped(tenantId, { festivalId }),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: RegistrationRow): Registration {
    const props: RegistrationProps = {
      id: row.id,
      tenantId: row.tenantId,
      festivalId: row.festivalId,
      participantName: row.participantName,
      participantEmail: row.participantEmail,
      participantCpf: row.participantCpf,
      songName: row.songName,
      performers: row.performers,
      musicComposer: row.musicComposer,
      lyricsComposer: row.lyricsComposer,
      videoUrl: row.videoUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Registration.restore(props);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/api && pnpm exec tsc --noEmit -p .`
Expected: no new errors (confirms `prisma.registration.*` from Task 1's generated client matches this repository's usage).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/registrations/infrastructure/prisma-registrations.repository.ts
git commit -m "feat(api): add PrismaRegistrationsRepository"
```

---

## Task 10: `RegistrationsController` + `RegistrationsModule`, wired into `AppModule`

**Files:**
- Create: `apps/api/src/registrations/infrastructure/registrations.controller.ts`
- Create: `apps/api/src/registrations/registrations.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–9.
- Produces: `POST /tenants/:tenantSlug/festivals/:festivalId/registrations`, `GET /tenants/:tenantSlug/festivals/:festivalId/registrations`, `GET /tenants/:tenantSlug/registrations`. Consumed by Task 11 (e2e), Task 12 (frontend API client).

- [ ] **Step 1: Implement the controller**

```ts
// apps/api/src/registrations/infrastructure/registrations.controller.ts
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
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { createRegistrationSchema } from '@fenac-platform/contracts';
import type { CreateRegistrationDto } from '@fenac-platform/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { InvalidFestivalStateExceptionFilter } from '../../common/filters/invalid-festival-state.filter';
import { RegistrationValidationExceptionFilter } from '../../common/filters/registration-validation.filter';
import { FindTenantBySlugUseCase } from '../../tenants/application/use-cases/find-tenant-by-slug.use-case';
import type { Tenant } from '../../tenants/domain/tenant.entity';
import { AdminAuthGuard } from '../../admin-identity/infrastructure/admin-auth.guard';
import type { RequestWithAdmin } from '../../admin-identity/infrastructure/admin-auth.guard';
import { FESTIVALS_REPOSITORY } from '../../festivals/application/ports/festivals-repository.port';
import type { FestivalsRepositoryPort } from '../../festivals/application/ports/festivals-repository.port';
import type { Festival } from '../../festivals/domain/festival.entity';
import { CreateRegistrationUseCase } from '../application/use-cases/create-registration.use-case';
import { ListRegistrationsUseCase } from '../application/use-cases/list-registrations.use-case';
import { ListFestivalRegistrationsUseCase } from '../application/use-cases/list-festival-registrations.use-case';
import type { Registration } from '../domain/registration.entity';

@Controller('tenants/:tenantSlug')
@UseGuards(AdminAuthGuard)
@UseFilters(InvalidFestivalStateExceptionFilter, RegistrationValidationExceptionFilter)
export class RegistrationsController {
  constructor(
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
    private readonly createRegistration: CreateRegistrationUseCase,
    private readonly listRegistrations: ListRegistrationsUseCase,
    private readonly listFestivalRegistrations: ListFestivalRegistrationsUseCase,
    @Inject(FESTIVALS_REPOSITORY)
    private readonly festivalsRepository: FestivalsRepositoryPort,
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

  private toRegistrationDto(registration: Registration, festival: Festival | null) {
    return {
      id: registration.id,
      festivalId: registration.festivalId,
      festivalNumber: festival?.number ?? null,
      festivalYear: festival?.year ?? null,
      festivalName: festival?.name ?? null,
      participantName: registration.participantName,
      participantEmail: registration.participantEmail,
      participantCpf: registration.participantCpf,
      songName: registration.songName,
      performers: registration.performers,
      musicComposer: registration.musicComposer,
      lyricsComposer: registration.lyricsComposer,
      videoUrl: registration.videoUrl,
      createdAt: registration.createdAt,
    };
  }

  @Post('festivals/:festivalId/registrations')
  @HttpCode(201)
  @UseGuards(RolesGuard)
  @Roles('ORGANIZER')
  @UseInterceptors(AuditLogInterceptor)
  @AuditLog('created_registration', (result: unknown) => ({
    targetType: 'Registration',
    targetId: (result as { id: string }).id,
  }))
  async create(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
    @Body(new ZodValidationPipe(createRegistrationSchema))
    body: CreateRegistrationDto,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const registration = await this.createRegistration.execute({
      tenantId: tenant.id,
      festivalId,
      ...body,
    });
    if (!registration) throw new NotFoundException('festival not found');
    const festival = await this.festivalsRepository.findById(tenant.id, festivalId);
    return this.toRegistrationDto(registration, festival);
  }

  @Get('festivals/:festivalId/registrations')
  async listByFestival(
    @Param('tenantSlug') tenantSlug: string,
    @Param('festivalId') festivalId: string,
    @Req() request: RequestWithAdmin,
  ) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const registrations = await this.listFestivalRegistrations.execute(tenant.id, festivalId);
    if (!registrations) throw new NotFoundException('festival not found');
    const festival = await this.festivalsRepository.findById(tenant.id, festivalId);
    return registrations.map((registration) => this.toRegistrationDto(registration, festival));
  }

  @Get('registrations')
  async listAll(@Param('tenantSlug') tenantSlug: string, @Req() request: RequestWithAdmin) {
    const tenant = await this.resolveTenantForAdmin(tenantSlug, request);
    const registrations = await this.listRegistrations.execute(tenant.id);
    const festivals = await this.festivalsRepository.findAllByTenant(tenant.id);
    const festivalById = new Map(festivals.map((festival) => [festival.id, festival]));
    return registrations.map((registration) =>
      this.toRegistrationDto(registration, festivalById.get(registration.festivalId) ?? null),
    );
  }
}
```

- [ ] **Step 2: Implement the module**

```ts
// apps/api/src/registrations/registrations.module.ts
import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { AdminIdentityModule } from '../admin-identity/admin-identity.module';
import { FestivalsModule } from '../festivals/festivals.module';
import { RegistrationsController } from './infrastructure/registrations.controller';
import { PrismaRegistrationsRepository } from './infrastructure/prisma-registrations.repository';
import { REGISTRATIONS_REPOSITORY } from './application/ports/registrations-repository.port';
import { CreateRegistrationUseCase } from './application/use-cases/create-registration.use-case';
import { ListRegistrationsUseCase } from './application/use-cases/list-registrations.use-case';
import { ListFestivalRegistrationsUseCase } from './application/use-cases/list-festival-registrations.use-case';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';

@Module({
  imports: [TenantsModule, AdminIdentityModule, FestivalsModule],
  controllers: [RegistrationsController],
  providers: [
    CreateRegistrationUseCase,
    ListRegistrationsUseCase,
    ListFestivalRegistrationsUseCase,
    RolesGuard,
    AuditLogInterceptor,
    { provide: REGISTRATIONS_REPOSITORY, useClass: PrismaRegistrationsRepository },
  ],
})
export class RegistrationsModule {}
```

- [ ] **Step 3: Wire into `AppModule`**

```ts
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { IdentityModule } from './identity/identity.module';
import { AdminIdentityModule } from './admin-identity/admin-identity.module';
import { FestivalsModule } from './festivals/festivals.module';
import { RegistrationsModule } from './registrations/registrations.module';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    IdentityModule,
    AdminIdentityModule,
    FestivalsModule,
    RegistrationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 4: Run the full backend suite**

Run: `cd apps/api && pnpm test`
Expected: all pass. (This step won't catch controller wiring mistakes like a missing NestJS provider — that's what Task 11's e2e test is for.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/registrations/infrastructure/registrations.controller.ts apps/api/src/registrations/registrations.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): add RegistrationsController and RegistrationsModule"
```

---

## Task 11: e2e test — `registrations.e2e-spec.ts`

**Files:**
- Create: `apps/api/test/registrations.e2e-spec.ts`

**Interfaces:**
- Exercises the full stack (real NestJS app + real MySQL via `PrismaService`) for everything built in Tasks 1–10. This is the first point where NestJS dependency injection wiring (module imports/exports from Task 8, provider registration from Tasks 9–10) is actually verified end-to-end.

- [ ] **Step 1: Write the test**

```ts
// apps/api/test/registrations.e2e-spec.ts
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
```

- [ ] **Step 2: Run it**

Run: `cd apps/api && pnpm run test:e2e -- registrations.e2e-spec.ts`
Expected: PASS (6 tests). Requires the docker-compose MySQL to be running and migrated (Task 1 already applied the migration to it).

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/registrations.e2e-spec.ts
git commit -m "test(api): add registrations e2e coverage"
```

---

## Task 12: Frontend API client — `src/lib/api/registrations.ts`

**Files:**
- Create: `apps/web/src/lib/api/registrations.ts`

**Interfaces:**
- Produces: `Registration` interface, `listRegistrations(token)`, `createRegistration(token, festivalId, body)`. Consumed by Task 14 (list page and create form).

- [ ] **Step 1: Implement the client (mirrors `src/lib/api/festivals.ts` exactly — no dedicated test, matching that file's own convention of being exercised only indirectly through the pages/forms that use it)**

```ts
// apps/web/src/lib/api/registrations.ts
import type { CreateRegistrationDto } from '@fenac-platform/contracts';
import { apiClient } from './client';

const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG;

export interface Registration {
  id: string;
  festivalId: string;
  festivalNumber: number | null;
  festivalYear: number | null;
  festivalName: string | null;
  participantName: string;
  participantEmail: string;
  participantCpf: string;
  songName: string;
  performers: string;
  musicComposer: string | null;
  lyricsComposer: string | null;
  videoUrl: string | null;
  createdAt: string;
}

function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function listRegistrations(token: string): Promise<Registration[]> {
  const response = await apiClient.get<Registration[]>(
    `/tenants/${tenantSlug}/registrations`,
    authHeader(token),
  );
  return response.data;
}

export async function createRegistration(
  token: string,
  festivalId: string,
  body: CreateRegistrationDto,
): Promise<Registration> {
  const response = await apiClient.post<Registration>(
    `/tenants/${tenantSlug}/festivals/${festivalId}/registrations`,
    body,
    authHeader(token),
  );
  return response.data;
}
```

- [ ] **Step 2: Verify the frontend still builds**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no new errors (confirms `CreateRegistrationDto` from `@fenac-platform/contracts` resolves — requires Task 2's package rebuild to already be done).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/registrations.ts
git commit -m "feat(web): add registrations API client"
```

---

## Task 13: Activate "Inscrições" in the sidebar

**Files:**
- Modify: `apps/web/src/components/layout/sidebar-nav-data.ts`

**Interfaces:**
- Produces: the "Inscrições" nav item moves from `status: 'soon'` to `status: 'active'`, which also makes it appear in `ACTIVE_NAV_ITEMS` (consumed by the command palette).

- [ ] **Step 1: Change the one line**

In `apps/web/src/components/layout/sidebar-nav-data.ts`, inside the `'Inscrições & Avaliação'` group, change:

```ts
      { label: 'Inscrições', href: '/inscricoes', icon: ClipboardIcon, status: 'soon' },
```

to:

```ts
      { label: 'Inscrições', href: '/inscricoes', icon: ClipboardIcon, status: 'active' },
```

Leave `'Classificação'` (the next line) untouched — it stays `'soon'`.

- [ ] **Step 2: Run the existing sidebar test**

Run: `cd apps/web && pnpm vitest run src/components/layout/sidebar.spec.tsx`
Expected: PASS — that test mocks `usePathname` to `/festivals` and only asserts on the Festivais/Premiações items, unaffected by this change.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/sidebar-nav-data.ts
git commit -m "feat(web): activate Inscrições in the sidebar"
```

---

## Task 14: Registrations list page + Nova Inscrição form modal

These two files are genuinely one deliverable, not two: `registrations-list.tsx` imports and renders `create-registration-form.tsx` directly (the "Nova Inscrição" button opens it in place, there is no intermediate route), so `registrations-list.spec.tsx` cannot pass — or even resolve its module graph — until both files exist. They are built and committed together in this single task.

**Files:**
- Create: `apps/web/app/(admin)/(protected)/inscricoes/page.tsx`
- Create: `apps/web/app/(admin)/(protected)/inscricoes/registrations-list.tsx`
- Create: `apps/web/app/(admin)/(protected)/inscricoes/registrations-list.spec.tsx`
- Create: `apps/web/app/(admin)/(protected)/inscricoes/create-registration-form.tsx`
- Create: `apps/web/app/(admin)/(protected)/inscricoes/create-registration-form.spec.tsx`

**Interfaces:**
- Consumes: `listRegistrations`/`createRegistration` (Task 12), `listFestivals`/`Festival` (existing, `src/lib/api/festivals.ts`), `DataTable`/`DataTableColumn`/`PageHeader`/`Button`/`FormModal`/`Field`/`Input`/`Label`/`FieldError`/`Select` (all existing), `createRegistrationSchema`/`CreateRegistrationDto` (Task 2).
- Produces: `RegistrationsList()` (renders the `/inscricoes` page) and `CreateRegistrationForm({ open, onOpenChange })` (composed inside `RegistrationsList`).

- [ ] **Step 1: Write both failing tests**

First, the list:

```tsx
// apps/web/app/(admin)/(protected)/inscricoes/registrations-list.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegistrationsList } from './registrations-list';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as registrationsApi from '../../../../src/lib/api/registrations';

vi.mock('../../../../src/lib/auth/auth-context');
vi.mock('../../../../src/lib/api/registrations');
vi.mock('../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('RegistrationsList', () => {
  it('renders each registration with its participant, song and festival edition', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      {
        id: 'r1',
        festivalId: 'f1',
        festivalNumber: 58,
        festivalYear: 2026,
        festivalName: 'FENAC 2026',
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
        musicComposer: null,
        lyricsComposer: null,
        videoUrl: null,
        createdAt: '2026-02-12T12:00:00.000Z',
      },
    ]);

    renderWithQueryClient(<RegistrationsList />);

    expect(await screen.findByText('Mai Sato')).toBeDefined();
    expect(screen.getByText('Chora Menino')).toBeDefined();
    expect(screen.getByText('58/2026')).toBeDefined();
  });

  it('filters by search across participant and song name', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(registrationsApi.listRegistrations).mockResolvedValue([
      {
        id: 'r1',
        festivalId: 'f1',
        festivalNumber: 58,
        festivalYear: 2026,
        festivalName: 'FENAC 2026',
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
        musicComposer: null,
        lyricsComposer: null,
        videoUrl: null,
        createdAt: '2026-02-12T12:00:00.000Z',
      },
      {
        id: 'r2',
        festivalId: 'f1',
        festivalNumber: 58,
        festivalYear: 2026,
        festivalName: 'FENAC 2026',
        participantName: 'João Silva',
        participantEmail: 'joao@example.com',
        participantCpf: '11111111111',
        songName: 'Luar do Sertão',
        performers: 'João Silva: Viola',
        musicComposer: null,
        lyricsComposer: null,
        videoUrl: null,
        createdAt: '2026-02-13T12:00:00.000Z',
      },
    ]);

    renderWithQueryClient(<RegistrationsList />);

    await screen.findByText('Mai Sato');
    const searchInput = screen.getByPlaceholderText('Buscar…');
    await import('@testing-library/user-event').then(({ default: userEvent }) =>
      userEvent.type(searchInput, 'João'),
    );

    expect(screen.getByText('João Silva')).toBeDefined();
    expect(screen.queryByText('Mai Sato')).toBeNull();
  });
});
```

Then, the form:

```tsx
// apps/web/app/(admin)/(protected)/inscricoes/create-registration-form.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateRegistrationForm } from './create-registration-form';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as registrationsApi from '../../../../src/lib/api/registrations';
import * as festivalsApi from '../../../../src/lib/api/festivals';

vi.mock('../../../../src/lib/auth/auth-context');
vi.mock('../../../../src/lib/api/registrations');
vi.mock('../../../../src/lib/api/festivals');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const openFestival = {
  id: 'f1',
  number: 58,
  year: 2026,
  name: 'FENAC 2026',
  registrationBegin: '2026-01-01T00:00:00.000Z',
  registrationEnd: '2026-03-01T00:00:00.000Z',
  votingBegin: null,
  votingEnd: null,
  status: 'OPEN' as const,
  inscriptionFee: 25,
  regulationUrl: null,
  allowedStates: [],
};

const draftFestival = { ...openFestival, id: 'f2', number: 59, year: 2027, status: 'DRAFT' as const };

describe('CreateRegistrationForm', () => {
  it('only lists OPEN festivals in the festival select', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.listFestivals).mockResolvedValue([openFestival, draftFestival]);

    renderWithQueryClient(<CreateRegistrationForm open onOpenChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('58/2026 — FENAC 2026')).toBeDefined());
    expect(screen.queryByText('59/2027 — FENAC 2027')).toBeNull();
  });

  it('submits the form, calls createRegistration with the selected festival, and closes the modal', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(festivalsApi.listFestivals).mockResolvedValue([openFestival]);
    vi.mocked(registrationsApi.createRegistration).mockResolvedValue({
      id: 'r1',
      festivalId: 'f1',
      festivalNumber: 58,
      festivalYear: 2026,
      festivalName: 'FENAC 2026',
      participantName: 'Mai Sato',
      participantEmail: 'mai.sato@example.com',
      participantCpf: '86359899531',
      songName: 'Chora Menino',
      performers: 'Mai Sato: Canto e Harpa',
      musicComposer: null,
      lyricsComposer: null,
      videoUrl: null,
      createdAt: '2026-02-12T12:00:00.000Z',
    });
    const onOpenChange = vi.fn();

    renderWithQueryClient(<CreateRegistrationForm open onOpenChange={onOpenChange} />);

    await waitFor(() => expect(screen.getByText('58/2026 — FENAC 2026')).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('Festival'), 'f1');
    await userEvent.type(screen.getByLabelText('Nome do participante'), 'Mai Sato');
    await userEvent.type(screen.getByLabelText('E-mail'), 'mai.sato@example.com');
    await userEvent.type(screen.getByLabelText('CPF'), '86359899531');
    await userEvent.type(screen.getByLabelText('Nome da música'), 'Chora Menino');
    await userEvent.type(screen.getByLabelText('Intérpretes'), 'Mai Sato: Canto e Harpa');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Inscrição' }));

    await waitFor(() =>
      expect(registrationsApi.createRegistration).toHaveBeenCalledWith('token-1', 'f1', {
        participantName: 'Mai Sato',
        participantEmail: 'mai.sato@example.com',
        participantCpf: '86359899531',
        songName: 'Chora Menino',
        performers: 'Mai Sato: Canto e Harpa',
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('renders nothing when open is false', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      admin: { id: '1', name: 'Ana', email: 'ana@example.com', role: 'ORGANIZER' },
      accessToken: 'token-1',
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithQueryClient(<CreateRegistrationForm open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByLabelText('Nome do participante')).toBeNull();
  });
});
```

- [ ] **Step 2: Run both to confirm they fail**

Run: `cd apps/web && pnpm vitest run "app/(admin)/(protected)/inscricoes/registrations-list.spec.tsx" "app/(admin)/(protected)/inscricoes/create-registration-form.spec.tsx"`
Expected: both FAIL — `Cannot find module './registrations-list'` and `Cannot find module './create-registration-form'`.

- [ ] **Step 3: Implement `registrations-list.tsx`**

```tsx
// apps/web/app/(admin)/(protected)/inscricoes/registrations-list.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { listRegistrations, type Registration } from '../../../../src/lib/api/registrations';
import { PageHeader } from '../../../../src/components/ui/page-header';
import { Button } from '../../../../src/components/ui/button';
import { DataTable, type DataTableColumn } from '../../../../src/components/ui/data-table';
import { PlusIcon } from '../../../../src/components/ui/icons';
import { CreateRegistrationForm } from './create-registration-form';

const COLUMNS: DataTableColumn<Registration>[] = [
  {
    header: 'Festival',
    render: (registration) =>
      registration.festivalNumber !== null
        ? `${registration.festivalNumber}/${registration.festivalYear}`
        : '—',
  },
  { header: 'Participante', render: (registration) => registration.participantName },
  { header: 'Música', render: (registration) => registration.songName },
  {
    header: 'Data',
    render: (registration) =>
      new Date(registration.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
  },
];

export function RegistrationsList() {
  const { accessToken } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: registrations, isLoading } = useQuery({
    queryKey: ['registrations'],
    queryFn: () => listRegistrations(accessToken as string),
    enabled: accessToken !== null,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inscrições"
        breadcrumb={[{ label: 'Home', href: '/dashboard' }, { label: 'Inscrições' }]}
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Nova Inscrição
          </Button>
        }
      />
      <DataTable
        title="Todas as inscrições"
        columns={COLUMNS}
        rows={registrations ?? []}
        rowKey={(registration) => registration.id}
        isLoading={isLoading}
        searchFields={(registration) => [registration.participantName, registration.songName]}
        emptyTitle="Nenhuma inscrição cadastrada"
        emptyDescription="Crie a primeira inscrição para começar."
      />
      <CreateRegistrationForm open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
```

- [ ] **Step 4: Implement `page.tsx`**

```tsx
// apps/web/app/(admin)/(protected)/inscricoes/page.tsx
import { RegistrationsList } from './registrations-list';

export default function InscricoesPage() {
  return <RegistrationsList />;
}
```

- [ ] **Step 5: Implement `create-registration-form.tsx`**

```tsx
// apps/web/app/(admin)/(protected)/inscricoes/create-registration-form.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRegistrationSchema, type CreateRegistrationDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { createRegistration } from '../../../../src/lib/api/registrations';
import { listFestivals } from '../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label, Select } from '../../../../src/components/ui/field';
import { FormModal } from '../../../../src/components/ui/form-modal';

export function CreateRegistrationForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [festivalId, setFestivalId] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRegistrationDto>({
    resolver: zodResolver(createRegistrationSchema),
  });

  const { data: festivals } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => listFestivals(accessToken as string),
    enabled: accessToken !== null && open,
  });
  const openFestivals = (festivals ?? []).filter((festival) => festival.status === 'OPEN');

  const mutation = useMutation({
    mutationFn: (values: CreateRegistrationDto) =>
      createRegistration(accessToken as string, festivalId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registrations'] });
      reset();
      setFestivalId('');
      onOpenChange(false);
    },
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova Inscrição"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isSubmitting={isSubmitting || mutation.isPending}
      submitLabel="Criar Inscrição"
    >
      <Field>
        <Label htmlFor="festivalId">Festival</Label>
        <Select
          id="festivalId"
          required
          value={festivalId}
          onChange={(event) => setFestivalId(event.target.value)}
        >
          <option value="" disabled>
            -- selecione um festival --
          </option>
          {openFestivals.map((festival) => (
            <option key={festival.id} value={festival.id}>
              {festival.number}/{festival.year} — {festival.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor="participantName">Nome do participante</Label>
        <Input id="participantName" type="text" {...register('participantName')} />
        <FieldError>{errors.participantName?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="participantEmail">E-mail</Label>
        <Input id="participantEmail" type="email" {...register('participantEmail')} />
        <FieldError>{errors.participantEmail?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="participantCpf">CPF</Label>
        <Input id="participantCpf" type="text" {...register('participantCpf')} />
        <FieldError>{errors.participantCpf?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="songName">Nome da música</Label>
        <Input id="songName" type="text" {...register('songName')} />
        <FieldError>{errors.songName?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="performers">Intérpretes</Label>
        <Input id="performers" type="text" {...register('performers')} />
        <FieldError>{errors.performers?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="musicComposer">Compositor(a) da música (opcional)</Label>
        <Input id="musicComposer" type="text" {...register('musicComposer')} />
      </Field>

      <Field>
        <Label htmlFor="lyricsComposer">Compositor(a) da letra (opcional)</Label>
        <Input id="lyricsComposer" type="text" {...register('lyricsComposer')} />
      </Field>

      <Field>
        <Label htmlFor="videoUrl">Link do vídeo (opcional)</Label>
        <Input id="videoUrl" type="url" {...register('videoUrl')} />
        <FieldError>{errors.videoUrl?.message}</FieldError>
      </Field>

      <FieldError>
        {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao criar inscrição.') : undefined}
      </FieldError>
    </FormModal>
  );
}
```

Note: `festivalId` is deliberately kept as plain component state, not a `react-hook-form` field — it selects which URL the mutation posts to (`createRegistration(token, festivalId, body)`), it is not part of `CreateRegistrationDto`'s body shape.

- [ ] **Step 6: Run both spec files to confirm they pass**

Run:
```bash
cd apps/web && pnpm vitest run "app/(admin)/(protected)/inscricoes/registrations-list.spec.tsx" "app/(admin)/(protected)/inscricoes/create-registration-form.spec.tsx"
```
Expected: PASS (2 tests in `registrations-list.spec.tsx`, 3 tests in `create-registration-form.spec.tsx`).

- [ ] **Step 7: Run the full frontend suite**

Run: `cd apps/web && pnpm test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(admin)/(protected)/inscricoes"
git commit -m "feat(web): add Inscrições list page and Nova Inscrição form modal"
```

---

## Task 15: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Backend — full suite, e2e, lint, build**

```bash
cd apps/api
pnpm test
pnpm run test:e2e
pnpm lint
pnpm build
```
Expected: all green. Fix any reported issue before proceeding.

- [ ] **Step 2: Frontend — full suite, lint, build**

```bash
cd apps/web
pnpm test
pnpm lint
pnpm build
```
Expected: all green. Fix any reported issue before proceeding.

- [ ] **Step 3: Manual check — create a real registration against the running stack**

With `docker compose up` running (or `pnpm --filter api dev` + `pnpm --filter web dev` locally), log in to the admin (`admin@fenac.local` / whatever `SEED_ADMIN_PASSWORD` is set to), open an existing OPEN festival (or publish one), navigate to "Inscrições" in the sidebar, click "Nova Inscrição", fill the form, and confirm:
- The new registration appears in the list immediately after creation.
- Selecting a DRAFT or CLOSED festival is impossible (the select only offers OPEN ones).
- Searching by participant name or song name filters the table.

Fix anything broken before considering this plan done — this step has no automated pass/fail.

- [ ] **Step 4: Final commit (only if Steps 1-3 required fixes)**

```bash
git add -A
git commit -m "fix: address issues found in registrations-core final verification"
```
