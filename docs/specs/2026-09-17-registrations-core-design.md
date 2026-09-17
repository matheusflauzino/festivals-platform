# FENAC Platform — Inscrições (núcleo)

Status: aprovado em brainstorming, pronto para writing-plans.
Depende de: `docs/specs/2026-09-15-fenac-platform-architecture-design.md` (padrão arquitetural do backend), `docs/specs/2026-09-17-admin-layout-redesign-design.md` (Sidebar, DataTable, FormModal já existem).
Próximo: plano de implementação via writing-plans.

## Contexto

O sistema legado (telas de referência enviadas pelo usuário) tem um módulo "Inscrições" rico: candidato, música (com vídeo/letra/instrumental), pagamento, verificação de documentos, avaliação por nota com comentários, histórico de participação, cidades aptas. Nada disso existe hoje no backend — confirmado por exploração: não há model `Registration` no Prisma, nem módulo, nem schema Zod, nem endpoint. `Festival.registrationBegin/registrationEnd`/`inscriptionFee` são só metadados do período — não existe nenhuma entidade "participante X se inscreveu no festival Y com a música Z".

Dado o tamanho do módulo completo, este documento cobre só o **núcleo**: uma inscrição (participante + música) vinculada a um festival, visível numa tela de listagem no admin. Avaliação por nota, pagamento, verificação de documento e histórico ficam para sub-projetos seguintes — cada um com seu próprio spec/plano, seguindo a mesma decomposição já usada neste repo (bootstrap → identity → festival-configuration → frontend-admin).

**Decisão de escopo (aprovada com o usuário):** não existe hoje nenhuma tela pública onde um participante se inscreve sozinho (`apps/web` só tem o grupo de rotas `(admin)`). Construir isso seria essencially um segundo frontend — fora de escopo aqui. Nesta fatia, o **admin cria a inscrição em nome do participante** (botão "Nova Inscrição"), e a inscrição guarda os dados de contato do participante diretamente (nome/e-mail/CPF) em vez de exigir uma conta `User` já existente — evita ter que "criar um `User` sem senha" só para popular esse fluxo. Vincular a um `User` autenticado real fica para quando a inscrição pública existir.

## 1. Modelo de dados

Novo model Prisma `Registration`, seguindo exatamente o padrão de `Stage`/`GradeCriterion` (tenantId denormalizado, sem cascade delete, `@map` para snake_case):

```prisma
model Registration {
  id                String   @id @default(uuid())
  tenantId          String   @map("tenant_id")
  festivalId        String   @map("festival_id")
  festival          Festival @relation(fields: [festivalId], references: [id])
  participantName   String   @map("participant_name")
  participantEmail  String   @map("participant_email")
  participantCpf    String   @map("participant_cpf")
  songName          String   @map("song_name")
  performers        String   @db.Text
  musicComposer     String?  @map("music_composer")
  lyricsComposer    String?  @map("lyrics_composer")
  videoUrl          String?  @map("video_url")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("registrations")
}
```

Adicionar `registrations Registration[]` na relação inversa de `Festival`. Sem `@@unique` em `(festivalId, participantCpf)` — o legado mostra o mesmo participante com músicas diferentes no mesmo festival (ex. "Mai Sato" com "Chora Menino" e "Banhar o Corpo"). `performers` é texto livre (`@db.Text`, pode ser longo — ex. "Mai Sato: Canto e Harpa, Giovani Di Ganzá: Rabeca") em vez de um modelo normalizado de múltiplos intérpretes — suficiente para o núcleo, evita uma tabela adicional.

Migration: `cd apps/api && pnpm exec prisma migrate dev --name add_registrations` (comando padrão do Prisma; não há script customizado no `package.json`).

## 2. Backend (`apps/api/src/registrations/`)

Mesma estrutura de `festivals/` (domain/application/infrastructure), só que como bounded context próprio (não sub-agregado de Festival), já que "inscrição" não pertence ao ciclo de vida do Festival:

```
registrations/
├── domain/
│   ├── registration.entity.ts (+ .spec.ts)
│   └── registration-validation.error.ts
├── application/
│   ├── ports/registrations-repository.port.ts
│   └── use-cases/
│       ├── create-registration.use-case.ts (+ .spec.ts)
│       ├── list-registrations.use-case.ts
│       └── list-festival-registrations.use-case.ts
├── infrastructure/
│   ├── registrations.controller.ts
│   ├── in-memory-registrations.repository.ts
│   └── prisma-registrations.repository.ts
└── registrations.module.ts
```

**Entidade** (`registration.entity.ts`): construtor privado + `props` imutável, factory `create(input)` com `randomUUID()` e validações síncronas (nome/nome da música/intérpretes não vazios; CPF com exatamente 11 dígitos, mesma regra de `participant-auth.schema.ts`), lançando `RegistrationValidationError` (mesmo padrão de `FestivalValidationError`); factory `restore(props)` para hidratação pelo repositório. Formato de e-mail e URL do vídeo ficam só no schema Zod da borda (`createRegistrationSchema`) — a entidade não duplica essa checagem, já que o controller sempre valida o body antes do use-case rodar. Sem métodos de transição de estado — a entidade não tem workflow neste núcleo.

**Regra de negócio "só inscreve em festival aberto e dentro da janela"**: isto é uma checagem **cross-aggregate** (Registration depende do estado de Festival) — o código atual não tem um exemplo pronto disso (confirmado: `CreateStageUseCase` só verifica existência do Festival, não status). Decisão de design: adicionar um método na própria entidade `Festival` (dona do estado), não espalhar a checagem solta no use-case:

```ts
// festival.entity.ts — método novo
isAcceptingRegistrations(now: Date): boolean {
  return (
    this.props.status === 'OPEN' &&
    now >= this.props.registrationBegin &&
    now <= this.props.registrationEnd
  );
}
```

`CreateRegistrationUseCase` injeta `FESTIVALS_REPOSITORY` (para buscar o Festival) e `REGISTRATIONS_REPOSITORY`:

```ts
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
```

Reaproveita `InvalidFestivalStateError` (já existe, já tem exception filter mapeando para 409) — não cria um erro novo só para isso.

**Controller** (`registrations.controller.ts`), base `@Controller('tenants/:tenantSlug')`, `@UseGuards(AdminAuthGuard)` de classe, mesmos exception filters de `festivals.controller.ts` (`InvalidFestivalStateExceptionFilter`, mais um `RegistrationValidationExceptionFilter` novo para 400):

- `POST festivals/:festivalId/registrations` — `@UseGuards(RolesGuard)` `@Roles('ORGANIZER')`, body validado com `createRegistrationSchema` via `ZodValidationPipe`, `@AuditLog('created_registration', ...)`. 404 se festival não existe (tenant-scoped), 409 se `InvalidFestivalStateError`, 400 se validação falhar.
- `GET festivals/:festivalId/registrations` — sem `@Roles` (leitura, como as demais rotas `GET` do repo), lista por festival.
- `GET registrations` — sem `@Roles`, lista todas do tenant (para a tela global do admin), ordenado por `createdAt desc`.

**Repositório Prisma** (`prisma-registrations.repository.ts`): estende `TenantScopedRepository`, `save()` faz `upsert` (padrão do repo), `findAllByFestival(tenantId, festivalId)`, `findAllByTenant(tenantId)` — ambos com `this.tenantScoped(...)`. Repositório InMemory equivalente para os testes de use-case (sem mocking framework — mesmo padrão de `InMemoryStagesRepository`).

**Módulo**: `RegistrationsModule` importa `TenantsModule`/`AdminIdentityModule`, mesmo padrão de providers com token custom (`{ provide: REGISTRATIONS_REPOSITORY, useClass: PrismaRegistrationsRepository }`). Registrado em `AppModule`.

## 3. Contrato compartilhado (`packages/contracts/src/registration.schema.ts`)

```ts
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

Exportado via `index.ts`, mesmo padrão dos schemas existentes.

## 4. Frontend

- `src/lib/api/registrations.ts`: `Registration` interface (espelha o DTO de resposta do controller, incluindo `festivalId` e dados do festival resumidos — `festivalNumber`/`festivalYear`/`festivalName` — para a coluna "Festival" da lista global sem precisar de N+1 requests), `listRegistrations(token)`, `listFestivalRegistrations(token, festivalId)`, `createRegistration(token, festivalId, body)`.
- Menu: em `sidebar-nav-data.ts`, o item "Inscrições" (grupo "Inscrições & Avaliação") muda de `status: 'soon'` para `status: 'active'`, `href: '/inscricoes'` (já correto).
- Nova rota `app/(admin)/(protected)/inscricoes/`: `page.tsx` + `registrations-list.tsx`, seguindo exatamente o padrão de `festival-list.tsx` — `PageHeader` (breadcrumb Home/Inscrições) + `DataTable` (colunas: Festival [`número/ano`], Participante, Música, Data [createdAt formatado pt-BR], busca por `searchFields` em participante/música), botão "Nova Inscrição" abrindo `FormModal`.
- `create-registration-form.tsx`: `FormModal` com `Select` de Festival (populado via `listFestivals`, **filtrado a `status === 'OPEN'`** no client — inscrever num festival fechado/rascunho não faz sentido e a UI não deveria nem oferecer a opção, embora o backend já rejeite com 409) + campos de participante (nome/e-mail/CPF) + campos de música (nome, intérpretes, compositor da música, compositor da letra — opcionais, URL do vídeo — opcional). Erro de submit usa `getApiErrorMessage` (já existe), mostrando a mensagem 409 do backend se o usuário selecionar um festival que fechou entre o carregamento da lista e o submit.

## 5. Testes

- Backend: `registration.entity.spec.ts` (validações), `create-registration.use-case.spec.ts` (com `InMemoryFestivalsRepository`+`InMemoryRegistrationsRepository`, cobrindo: cria com sucesso quando festival OPEN e dentro da janela; rejeita com `InvalidFestivalStateError` quando DRAFT/CLOSED ou fora da janela; isolamento por tenant retorna `null`), `test/registrations.e2e-spec.ts` (mesmo padrão de `festivals.e2e-spec.ts` — sobe app real, cria tenant+admin+festival OPEN, cria inscrição via HTTP, lista).
- Frontend: `registrations-list.spec.tsx` (renderiza linhas, busca filtra), `create-registration-form.spec.tsx` (submete, chama `createRegistration`, fecha modal).

## Fora de escopo (sub-projetos seguintes)

- Avaliação por nota (jurado avalia inscrição usando os `GradeCriterion` já existentes) — precisa de um novo model ligando `AdminUser` (role JUDGE) + Registration + GradeCriterion.
- Pagamento, verificação de documento, histórico de participação, cidades aptas.
- Inscrição pública (participante autenticado se inscrevendo sozinho) — quando existir, o campo `participantEmail`/`participantCpf` desta fatia deveria migrar para um FK real em `User`, com find-or-create no momento do cadastro público.
- Tela de detalhe/audição da inscrição (vídeo, comentários) — só a listagem entra aqui.

## Rastreabilidade

- Padrão arquitetural replicado de `apps/api/src/festivals/` (verificado arquivo a arquivo: entidade, use-case, controller, repositório Prisma, módulo, testes) — nenhuma convenção nova introduzida além da checagem cross-aggregate `isAcceptingRegistrations`, que é uma extensão natural do padrão existente (regra de estado vive na entidade dona do estado).
- Menu "Inscrições" já reservado como `status: 'soon'` em `docs/specs/2026-09-17-admin-layout-redesign-design.md` — este spec é o que o torna `'active'`.
