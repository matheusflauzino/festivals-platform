# FENAC Platform — Spec de Arquitetura (Sub-projeto 2)

Status: aprovado por seções em brainstorming, pronto para writing-plans.
Depende de: `docs/discovery/01-05` (Sub-projeto 1 — descoberta e decisões de produto).
Próximo: Sub-projeto 3 (spec de migração de dados) e Sub-projeto 4 (plano de implementação via writing-plans).

## Contexto

Reengenharia do sistema de inscrição do Festival Nacional da Canção (FENAC), hoje em PHP/Laravel
(`fenac-inscricoes`), para uma plataforma NestJS + Next.js, mantendo toda a lógica de negócio já
validada na descoberta, mas corrigindo as inconsistências e lacunas identificadas (ver
`docs/discovery/02-business-rules.md` e `05-decisions-and-improvements.md`). O sistema nasce
multi-tenant (para viabilizar venda futura a outros festivais) mas atende só a FENAC no
lançamento. Restrição central: infraestrutura barata o suficiente para ser operada por uma pessoa
e cobrada como um serviço de baixo custo mensal — isso descarta AWS/S3/mensageria dedicada como
requisitos de dia 1, mas todo ponto de integração externa (storage, email, pagamento) é desenhado
atrás de uma interface para não travar a evolução futura.

## 1. Stack & Monorepo

- **Backend**: NestJS (última versão estável), TypeScript, MySQL via **Prisma ORM**.
- **Frontend**: Next.js (App Router, última versão), Tailwind CSS, componentes inspirados no
  TailAdmin para a área administrativa.
- **Monorepo**: pnpm workspaces + Turborepo — `apps/api` (NestJS), `apps/web` (Next.js),
  `packages/contracts` (DTOs/schemas Zod compartilhados entre backend e frontend).
- **Containerização**: Docker Compose com serviços `api`, `web`, `mysql`, volume nomeado para
  arquivos de áudio/vídeo/documentos.

## 2. Arquitetura do Backend (Clean Architecture por módulo)

Módulos de negócio: `identity`, `tenants`, `festivals`, `inscriptions`, `judging`, `voting`,
`payments`, `files`, `notifications`. Cada um em três camadas:

- **Domain**: entidades e regras puras, sem dependência de NestJS/Prisma. Value objects para `CPF`,
  `CNPJ` (alfanumérico), `Money`.
- **Application**: casos de uso (`SubmitInscriptionUseCase`, `CastVoteUseCase`, etc.), orquestram
  entidades e portas/interfaces. É aqui que mora a lógica de negócio extraída da descoberta (regras
  condicionais por nacionalidade/residência, quota por fase, etc.).
- **Infrastructure**: repositórios Prisma, provedores concretos de storage/email/pagamento,
  controllers NestJS (adaptadores HTTP).

Essa separação existe para viabilizar TDD de verdade: casos de uso testados com repositórios em
memória (rápido, sem banco); só testes de integração tocam MySQL real.

**Multi-tenancy**: banco único, toda tabela tenant-scoped tem `tenant_id`. Um
`TenantScopedRepository` base recebe o `tenantId` do contexto de requisição (via
`TenantContextInterceptor`, lendo o claim do JWT nas rotas admin, ou o tenant resolvido por
URL/slug nas rotas públicas) e injeta automaticamente `where: { tenantId }` — nenhum repositório
concreto escreve essa cláusula manualmente.

Alternativa avaliada e descartada para o v1: banco/schema separado por tenant (isolamento mais
forte, mas custo operacional que não se paga com um único tenant ativo). A separação em
repositórios por interface deixa essa migração possível depois, sem reescrever a lógica de negócio.

## 3. Autenticação & Autorização

Dois contextos de auth separados:

- **Participante**: login por email ou CPF + senha, JWT de acesso curto + refresh token (httpOnly
  cookie). Sem papéis — sempre "candidato".
- **Admin**: login só por convite (sem auto-registro público). JWT carrega `tenantId` + `role`
  (`ORGANIZER`, `JUDGE`, `COMMITTEE`). `RolesGuard` decora cada endpoint com os papéis permitidos; a
  tela de avaliação de inscrição usa o mesmo papel no frontend para mostrar/esconder seções, sem
  duplicar rota (jurado vê música+mídia+nota; organizador vê tudo).
- Toda ação administrativa sensível sobre contas de usuário (alterar email/CPF, resetar senha,
  excluir) passa por um `AuditLogInterceptor`.

## 4. Storage & Email (Strategy Pattern)

- **`StorageProvider`**: `save(file, context) → StorageKey`, `getUrl(key)`, `delete(key)`.
  Implementação padrão: `LocalDiskStorageProvider` (volume Docker). Implementação futura:
  `S3StorageProvider` — troca por variável de config, sem alterar casos de uso. A entidade `File`
  carrega tipo, mimetype, tamanho e dono (lacuna do legado, que salva paths crus sem metadados).
- **`MailProvider`**: `send(template, to, data)`. Produção: **Mailgun**. Dev/test: **Mailtrap**
  (SMTP). Sem fila de mensageria dedicada — envio assíncrono best-effort via `EventEmitterModule`
  do próprio NestJS (ex: `InscriptionSubmittedEvent` → listener envia o email), preservando o
  comportamento "loga erro mas não falha a requisição" do legado sem acoplar caso de uso a envio de
  email.

## 5. Pagamentos

Integração com a **API PIX do Efí Bank** (dev.efipay.com.br), usando o módulo de **link de
pagamento** — o backend gera o link via API do Efí quando o candidato opta por pagamento online, o
participante paga pelo link (QR Code/copia-e-cola), um webhook do Efí atualiza o status de forma
assíncrona. Abstraído atrás de uma porta `PaymentGateway`, com enum de status próprio e agnóstico
de gateway (`PENDING`, `PROCESSING`, `PAID`, `FAILED`, `REFUNDED`) mapeado a partir dos webhooks —
evita o erro do legado de acoplar o domínio ao vocabulário de status de um gateway específico (o
que a descoberta identificou no `status_payment` do PagSeguro). Isso viabiliza expandir depois para
cartão/boleto (o próprio Efí oferece ambos) ou trocar de provedor sem tocar nos casos de uso. O
fluxo manual de depósito/PIX com upload de comprovante continua disponível em paralelo.

## 6. Modelo de Domínio (principais mudanças vs. legado)

- **`Tenant`**: nova entidade raiz — nome, CNPJ (alfanumérico), slug/subdomínio, status.
- **`Festival`** ganha `stages` (fases: classificatória/semifinal/final, cada uma com
  `advancementQuota`) e `gradeCriteria` (critérios de nota com peso, por fase) — substitui o
  `festival_grades` ambíguo do legado (que significava "nota" em 2019 e parecia "cidade" em 2025)
  por dois conceitos explícitos e sem sobreposição.
- **`Inscription`** preserva os campos centrais (tipo áudio/vídeo, compositores, intérprete,
  instrumentos, impedimentos de data) e adiciona `interpreterCitizenshipProofId`/
  `composerCitizenshipProofId`.
- **`Vote`** vira multi-critério: um registro por (jurado, inscrição, critério, fase), em vez de um
  valor único por voto.
- **`Classification`** continua sendo decisão manual de staff, agora referenciando fase e quota
  (com aviso visual ao ultrapassar, sem bloqueio).
- **`User`** (candidato, mantém CPF como identidade de login) e **`AdminUser`** (com `role`; CNPJ
  vive só em `Tenant`, não em `AdminUser`).
- **`AuditLog`**: nova entidade, cobre a lacuna de auditoria identificada no `fenac-inscricoes`.

## 7. Frontend (Next.js)

Um app único, dois grupos de rotas isolados por layout:

- **`app/(admin)/...`**: shell estilo dashboard (sidebar + topbar, inspirado no TailAdmin),
  autenticado via JWT de admin, seções: Dashboard, Configuração do Festival (fases + critérios +
  quotas num fluxo único), Inscrições (busca com ações em lote e filtros salvos), Classificados,
  Relatórios (incl. relatórios salvos), Usuários (com log de auditoria visível).
- **`app/(public)/...`**: formulário limpo, sem sidebar — login/cadastro, wizard de inscrição
  multi-etapas (Tipo → Música → Arquivos → Pagamento → Confirmação), dashboard do participante
  (status + prazo + avisos), votação pública.
- Tipos e schemas de validação compartilhados via `packages/contracts` — mesmo schema Zod valida
  client e server (ex: a lógica condicional por nacionalidade/residência).

## 8. Testes & TDD

- **Backend**: Jest. Casos de uso testados com repositórios fake/in-memory (cobertura principal,
  roda sem banco). Testes de integração (Prisma real + MySQL de teste via Docker) cobrem o mapeamento
  objeto-relacional. TDD: teste do caso de uso escrito antes da implementação.
- **Frontend**: Vitest + Testing Library para componentes/formulários, Playwright para fluxos
  críticos ponta-a-ponta (inscrição completa, pagamento PIX, votação pública).
- Cada regra citada em `docs/discovery/02-business-rules.md` vira pelo menos um teste de aceitação
  rastreável, evitando regressão silenciosa na reengenharia.

## 9. Migração de Dados (visão geral — detalhamento no Sub-projeto 3)

Script Node.js/TypeScript standalone, rodado uma única vez no cutover: conecta no MySQL legado do
`fenac-inscricoes`, transforma e escreve no novo schema via os mesmos `Repository`s da camada de
infraestrutura (não SQL solto), garantindo que dados migrados passem pelas mesmas validações de
domínio. Prioridade: festivais 48+ (histórico operacional real, 2018 em diante) e usuários;
festivais 1-47 (1972-2018) migram como timeline simples, sem tentar reconstruir dados operacionais
que nunca existiram. Arquivos locais são copiados para o volume do novo `LocalStorageProvider`,
preservando referência via a nova entidade `File`.

## 10. Deploy & Infraestrutura

Uma VPS (Hetzner/DigitalOcean/Contabo), Docker Compose orquestrando `api`, `web`, `mysql`, reverse
proxy (Traefik ou Nginx) com TLS automático (Let's Encrypt), volume nomeado para arquivos. Backup
do banco via `mysqldump` agendado (cron), substituindo a tela de backup manual do admin (decisão
tomada na entrevista). CI (GitHub Actions) roda testes + build antes de deploy; deploy via SSH +
`docker compose pull && up -d` — sem orquestrador pesado, alinhado ao orçamento de infra.

## Rastreabilidade

Toda decisão estrutural e melhoria por tela referenciada aqui foi validada explicitamente com o
usuário durante o brainstorming — ver `docs/discovery/05-decisions-and-improvements.md` para a
lista completa com o "porquê" de cada uma.
