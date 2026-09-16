# FENAC Platform — Frontend Admin (Auth + Shell + Festivais)

Status: aprovado por seções em brainstorming, pronto para writing-plans.
Depende de: `docs/specs/2026-09-15-fenac-platform-architecture-design.md` (§7, Frontend), backend já mergeado em `main` — módulos `tenants`, `admin-identity` (convite/login/RBAC), `festivals` (CRUD + fases + critérios).
Próximo: plano de implementação via writing-plans. Gestão de admins/convites (UI) fica para um sub-projeto seguinte, fora deste escopo.

## Contexto

`apps/web` hoje é só o scaffold do plano de Bootstrap (Next.js 16 App Router, React 19, Tailwind v4, Vitest+Testing Library) — nenhuma tela real existe ainda. Este sub-projeto constrói a primeira fatia navegável da área administrativa: login, o shell do dashboard, e a gestão de Festivais (a única superfície de API já pronta no backend com CRUD completo: `FestivalsController`, 10 endpoints, `Festival`/`Stage`/`GradeCriterion`). Gestão de usuários/admins (convite, listagem) fica para um plano seguinte, menor e independente — mantém este plano como uma fatia entregável e testável por si só, consistente com a decomposição já usada no plano de Festival Configuration.

## 1. Stack

Novas dependências em `apps/web`:
- `@tanstack/react-query` — cache e estado das chamadas à API (`useQuery`/`useMutation`).
- `react-hook-form` + `@hookform/resolvers` — formulários, validados com os mesmos schemas Zod já usados no backend, importados de `@fenac-platform/contracts` (`createFestivalSchema`, `updateFestivalSchema`, `createStageSchema`, `createGradeCriterionSchema`, `loginAdminUserSchema`).
- `axios` — client HTTP fino com um interceptor de request (injeta `Authorization: Bearer <accessToken>`) e um interceptor de response (401 → tenta um refresh, repete a chamada original; se o refresh falhar, desloga).

Nenhuma biblioteca de componentes de UI é adicionada — os componentes de dashboard (sidebar, topbar, tabela, badge, form fields) são construídos com Tailwind puro, inspirados visualmente no TailAdmin, sem depender do pacote TailAdmin em si.

## 2. Autenticação

O desafio central: o access token da API dura 15 minutos e vem no corpo JSON da resposta de login (não em cookie); o refresh token é um cookie `httpOnly` que o JS nunca lê diretamente. Isso é resolvido tratando `app/(admin)/...` como uma área majoritariamente client-rendered (SPA-style dentro do App Router), não como Server Components buscando dados no servidor — a alternativa (um BFF via Route Handlers do Next.js fazendo proxy da sessão) foi avaliada e descartada por inflar o escopo sem ganho de segurança proporcional, já que o access token nunca é persistido (sempre em memória, nunca `localStorage`).

Fluxo:

1. **Login** (`/login`, fora do shell autenticado): form com `email`/`password` (`loginAdminUserSchema`), envia `POST /tenants/:tenantSlug/admin/login`. `tenantSlug` vem de `NEXT_PUBLIC_TENANT_SLUG` (env var) — o sistema é single-tenant no lançamento (FENAC), então não há necessidade de pedir o slug no formulário. Sucesso: `AuthProvider` guarda `accessToken`+`admin` em memória (React context), navega para `/festivals`. O cookie `adminRefreshToken` já foi setado pelo backend (`httpOnly`, `secure` em produção, `path` escopado ao tenant).

2. **Carregamento/refresh de página**: `AuthProvider`, ao montar, chama `POST /tenants/:tenantSlug/admin/refresh` silenciosamente (o browser envia o cookie automaticamente). Sucesso preenche `accessToken` sem exigir novo login; falha redireciona para `/login`.

3. **Chamadas autenticadas**: o interceptor de request injeta o `Authorization` header. Em caso de 401 no meio do uso (token expirado), o interceptor de response tenta UM refresh automático e repete a chamada original; se o refresh também falhar, desloga e redireciona.

4. **Logout**: limpa `accessToken` da memória e navega para `/login`. Não existe endpoint de logout no backend — o cookie `adminRefreshToken` permanece válido até expirar naturalmente (7 dias). Aceitável para este MVP; registrado como lacuna conhecida (item de acompanhamento futuro, não bloqueador).

5. **RBAC no client**: `admin.role` (do login/`/me`) controla visibilidade de ações na UI (ex: botão "Criar Festival" só para `ORGANIZER`) — isso é só UX; a autorização real é sempre aplicada pelo backend (`RolesGuard`). A UI nunca é a fonte de verdade de permissão.

`RequireAuth` (wrapper usado no layout do grupo `(admin)`) redireciona para `/login` se não autenticado após a tentativa de refresh inicial.

## 3. Telas

- **Shell** (`app/(admin)/layout.tsx`): sidebar com link para Festivais (Usuários fica como item desabilitado "em breve") + topbar com nome/role do admin logado e botão de logout.
- **Lista de Festivais** (`/festivals`): tabela (número/ano, nome, status, ações), dados de `GET /tenants/:slug/festivals` via `useQuery`. Badge por status (DRAFT cinza, OPEN verde, CLOSED vermelho). Botão "Novo Festival".
- **Criar Festival** (`/festivals/new`): form com os campos de `createFestivalSchema` (número, ano, nome, janelas de inscrição/votação, valor, UFs permitidas — multi-select simples, URL do regulamento), validado client-side com o mesmo schema Zod do backend via `@hookform/resolvers/zod`.
- **Detalhe do Festival** (`/festivals/[festivalId]`): dados do festival, botão "Editar" (mesmo form em modo edição, `updateFestivalSchema`), botões "Publicar"/"Fechar" condicionais ao status atual (só aparecem quando a transição é válida, espelhando as regras do backend), e lista de Fases com botão "Nova Fase".
- **Fases e Critérios** (`/festivals/[festivalId]/stages/new`, `/festivals/[festivalId]/stages/[stageId]/grade-criteria/new`): forms simples reaproveitando `createStageSchema`/`createGradeCriterionSchema`.

## 4. Tratamento de erro

Cada mutação mapeia a resposta de erro da API: 400 (validação) mostra os erros por campo direto no form (a maioria já é pega antes de enviar, já que o client valida com o mesmo schema); 409 (conflito de número/ano duplicado, ou transição de estado inválida em publicar/fechar) mostra a mensagem da API num alerta/toast; 401/403 são tratados pelo fluxo de auth (seção 2). Um `ErrorBoundary` genérico cobre falhas inesperadas de renderização.

## 5. Testes

Vitest + Testing Library (já configurados) para componentes/forms — ex: "form de criar festival mostra erro de validação quando `registrationBegin` é depois de `registrationEnd`", "lista de festivais renderiza o badge correto por status". Playwright para 1-2 fluxos críticos ponta-a-ponta (login → criar festival → publicar), rodando contra a API real via Docker Compose, seguindo o mesmo TDD já praticado no backend, adaptado para o nível de componente/fluxo em vez de unidade de domínio.

## 6. Bootstrap local (script de seed)

Um script standalone `pnpm --filter api run seed:admin` (não um endpoint HTTP — a regra "admin só por convite" continua intacta em produção) que cria, via Prisma diretamente:
- Um `Tenant` com slug `fenac` (reaproveita se já existir).
- Um `AdminUser` `ORGANIZER` já `ACTIVE`, com email fixo de dev (`admin@fenac.local`) e senha lida de uma env var (ou gerada e impressa no console se ausente).

Documentado no `README` como passo de setup local. Mesma técnica de seed já usada nos testes e2e do backend (`AdminUser.invite(...).activate(...)` + `prisma.adminUser.create(...)`).

## Rastreabilidade

- §7 do spec de arquitetura original (dois grupos de rota, shell TailAdmin-inspired, schemas compartilhados) → seções 1-3 deste documento.
- Endpoints já existentes e reaproveitados sem modificação: `POST/GET /tenants/:slug/admin/login|refresh|me`, `POST/GET/PATCH /tenants/:slug/festivals`, `POST .../publish`, `POST .../close`, `POST/GET .../stages`, `POST/GET .../stages/:id/grade-criteria`.
- Lacuna conhecida, não bloqueadora: sem endpoint de logout no backend (cookie de refresh expira naturalmente em 7 dias).
- Fora de escopo deste plano: gestão de admins/convites (UI), telas de Categoria/Cidade/Instrumento (aguardam seus próprios sub-projetos de backend).
