# FENAC Platform — Admin Layout Redesign (Shell, Design System, Data Table/Modal Foundation)

Status: aprovado em brainstorming, pronto para writing-plans.
Depende de: `docs/specs/2026-09-16-frontend-admin-design.md` (auth, tratamento de erro, integração com API — inalterados por este documento). Este documento substitui apenas a seção 3 (Telas) e o sistema visual daquele spec.
Próximo: plano de implementação via writing-plans.

## Contexto

A primeira versão visual do admin (paleta azul/violeta + Manrope/Fraunces, `dashboard-shell.tsx` simples com sidebar fixa de um item) não passou no teste do usuário — "não ficou muito legal". O pedido agora é adotar o padrão estrutural de um admin dashboard profissional de referência (TailAdmin — `nextjs-demo.tailadmin.com`): sidebar por grupos colapsável, header com busca/tema/notificações/usuário, breadcrumbs, cards, data tables ricas, e sobretudo modals/form modals como padrão de interação — com uma biblioteca de componentes reutilizável, já que o sistema terá muitas telas de CRUD e relatórios.

Contexto de domínio adicional (telas do sistema legado enviadas como referência, **não como padrão visual** — apenas para mapear os módulos que o sistema vai precisar): Dashboard com contadores de inscrição/avaliação, Inscrições (com áudio/vídeo e avaliação por nota), Classificação, Cadastro de Festivais/Premiações/Notas/Instrumentos, Relatórios (inscrições, votação online, mala direta, ficha de inscrição), Backups, Usuários. Só **Festivais** (com Fases e Critérios de Nota aninhados) tem API pronta hoje; o resto entra no menu como item "em breve" para já fixar a arquitetura de informação.

## 1. Sistema de tokens (paleta, tipografia, dark mode)

Mantém a identidade FENAC (viola/violeta + o tom cedro reservado à marca) em vez de adotar a paleta azul/indigo genérica do TailAdmin — mas reestrutura os tokens para um vocabulário semântico (`canvas`/`surface`/`border`/`text`/`brand`) que suporta dark mode via classe `.dark` na `<html>`.

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--color-canvas` | `#F9FAFB` | `#14121F` | fundo da página |
| `--color-surface` | `#FFFFFF` | `#1C1930` | sidebar, header, cards |
| `--color-surface-muted` | `#F3F4F6` | `#241F3D` | cabeçalho de tabela, hover de linha |
| `--color-border` | `#E5E7EB` | `#322C4D` | divisórias, bordas de card |
| `--color-text` | `#1F1B2C` | `#F1EEFB` | texto principal |
| `--color-text-muted` | `#6B6478` | `#A79FC2` | texto secundário |
| `--color-text-subtle` | `#9CA3AF` | `#746C93` | placeholder, desabilitado |
| `--color-brand` | `#7D4FD1` | `#A78BFA` | ações primárias, links, item ativo |
| `--color-brand-strong` | `#6A3DB8` | `#C4B2FF` | hover de ação primária |
| `--color-brand-soft` | `#F1EBFC` | `#2E2650` | fundo do item de menu ativo |
| `--color-accent` (só logo) | `#C97B4A` | `#E08F5E` | roseta da marca, nunca em UI interativa |
| status draft/open/closed/warning (bg/fg) | tons já existentes | variante escura equivalente | badges |

Tailwind v4: `@custom-variant dark (&:where(.dark, .dark *));` + tokens redefinidos em `.dark`. A maioria dos componentes usa classes semânticas (`bg-surface`, `text-muted`, `border-default`) em vez de `dark:` espalhado pelo código — o próprio token muda de valor.

Tipografia: um único family (Manrope, já carregada via `next/font`), removendo o par com Fraunces serifada — a serifa editorial não serve a um painel denso de tabelas. Escala: título de página 24px/600, título de seção 18px/600, corpo 14px/400, label/botão 14px/500, cabeçalho de tabela 13px/500 (sem versalete/caixa alta).

Toggle de tema: `ThemeProvider` lê `localStorage('fenac-theme')` ou `prefers-color-scheme` no primeiro render; um script inline no `<head>` de `app/layout.tsx` aplica a classe antes da hidratação (evita flash de tema errado). `ThemeToggle` no header alterna e persiste.

## 2. Estrutura de layout e navegação

```
┌─Sidebar (260px, colapsa p/ 80px)─┬─Header──────────────────────────────┐
│ Logo FENAC                       │ [≡ mobile] [Buscar ⌘K]  [🌙][👤▾]   │
│ GRUPO                            ├──────────────────────────────────────┤
│  • Item (ativo: fundo brand-soft)│  Título da Página        Home > X    │
│  • Item "em breve" (badge, disabled) │  [PageHeader action]              │
│ GRUPO                             │  [Card: DataTable / Form / etc.]    │
│  ...                              │                                      │
│ [botão colapsar]                  │                                      │
└───────────────────────────────────┴──────────────────────────────────────┘
```

Mobile (<1024px): sidebar vira drawer off-canvas acionado pelo botão hamburger do header, com backdrop.

### Árvore de menu (definida em `sidebar-nav-data.ts`, tipada, com `status: 'active' | 'soon'`)

- **Visão Geral** — Dashboard (ativo, `/dashboard`)
- **Cadastros** — Festivais (ativo) · Premiações, Critérios de Nota, Instrumentos (em breve)
- **Inscrições & Avaliação** — Inscrições, Classificação (em breve)
- **Relatórios** — Relatório de Inscrições, Resultado da Votação Online, Mala Direta, Ficha de Inscrição (em breve)
- **Administração** — Usuários, Backups (em breve)

Itens "em breve" são visíveis mas não navegáveis (sem `href` funcional, cursor `not-allowed`, badge textual "em breve") — cumprem o pedido de já visualizar a estrutura final do sistema sem simular páginas vazias enganosas.

"Alterar Senha" e "Sair" ficam no dropdown do avatar no header (não na sidebar) — reduz ruído e segue o padrão do TailAdmin.

### Busca (⌘K)

Em vez de uma caixa de busca decorativa sem função (má UX — affordance que não faz nada), o campo "Buscar" do header abre um `CommandPalette` (modal) que filtra e navega pelos itens **ativos** da árvore de menu — pequeno, real, e reforça exatamente o que foi pedido ("já deixar os menus visualizáveis").

## 3. Biblioteca de componentes

`src/components/layout/`: `sidebar.tsx`, `sidebar-nav-data.ts`, `sidebar-context.tsx` (estado colapsado/mobile, persistido), `header.tsx`, `breadcrumb.tsx`, `command-palette.tsx`, `theme-provider.tsx`, `theme-toggle.tsx`, `app-shell.tsx` (substitui `dashboard-shell.tsx`), `icons.tsx` (set mínimo de ícones outline desenhados à mão — sem nova dependência).

`src/components/ui/` (estende o que já existe — `button.tsx`, `field.tsx`, `page-header.tsx`): `card.tsx`, `badge.tsx` (genérico por tom, `festival-status-badge.tsx` vira wrapper fino), `table.tsx` (primitivas) + `data-table.tsx` (busca client-side, vazio, skeleton, paginação), `pagination.tsx`, `modal.tsx` (portal, focus trap, ESC, click fora) + `confirm-modal.tsx`, `form-modal.tsx` (Modal + rodapé padronizado Cancelar/Salvar ligado a `isSubmitting`), `dropdown-menu.tsx`, `avatar.tsx` (iniciais), `select.tsx`/`textarea.tsx`, `empty-state.tsx`, `skeleton.tsx`, `stat-card.tsx`.

Cada componente é independente, testável isoladamente (Vitest + Testing Library) e sem acoplamento a uma tela específica.

## 4. Onde modals/form modals entram de verdade

Verificado contra os testes existentes para não quebrar nada:

- **Nova Fase** e **Novo Critério de Nota**: hoje são páginas (`/stages/new`, `/grade-criteria/new`) sem teste de navegação (`festival-detail.spec.tsx` não testa esses links, e os `.spec.tsx` dos forms renderizam o componente isolado, não a rota). Viram **FormModal** abertos a partir da página de detalhe do festival. As rotas `page.tsx` correspondentes são removidas; `create-stage-form.tsx`/`create-grade-criterion-form.tsx` (e specs) sobem um nível, para perto de onde passam a ser usados. Cada form ganha uma prop opcional `onSuccess?: () => void` (chamada além do `router.push` existente, para fechar o modal) — mudança aditiva, não quebra os testes atuais.
- **Fechar Festival**: ganha um `ConfirmModal` (ação pouco reversível). Não há teste hoje para o clique em "Fechar" (só para "Publicar"), então a mudança de comportamento (era imediato, passa a exigir confirmação) é segura.
- **Editar Festival** (novo): `FormModal` usando `updateFestival` — endpoint e schema (`updateFestivalSchema`) já existem na API/contracts mas não têm tela nenhuma hoje. Mesmos campos expostos pelo form de criação (nome, datas, taxa) — não expande escopo para `allowedStates`/`regulationUrl`, que também não estão no form de criação atual.
- **Novo Festival** continua página cheia: o teste e2e (`admin-festival-flow.spec.ts`) verifica a URL `/festivals/new` explicitamente. Só é restilizado com os novos `Card`/`Field`.

## 5. Páginas afetadas

1. `(protected)/layout.tsx` passa a usar `AppShell` em vez de `DashboardShell`.
2. `login/page.tsx` + `login-form.tsx`: card centralizado com a marca, novos componentes, sem mudança de lógica.
3. Nova rota `/dashboard`: `StatCard`s reais (contagem de festivais por status, derivada do `useQuery` já existente — nada inventado) + atalho para a lista de festivais. O login continua redirecionando para `/festivals` como hoje (`admin-festival-flow.spec.ts` verifica essa URL) — mudar o destino pós-login é uma decisão de fluxo de auth, fora do escopo deste documento; `/dashboard` é acessível pelo menu, não é o landing obrigatório.
4. `festivals/festival-list.tsx`: `PageHeader` com breadcrumb, `DataTable` (busca, colunas: Edição, Nome, Período de Inscrição, Taxa, Status), link "Novo Festival" inalterado (→ página).
5. `festivals/new/create-festival-form.tsx`: restilizado em `Card`, mesma lógica.
6. `festivals/[festivalId]/festival-detail.tsx`: `PageHeader` com breadcrumb, badge de status, "Editar" (novo, `FormModal`), "Publicar" (inalterado), "Fechar" (agora com `ConfirmModal`), lista de Fases em `DataTable`/`Card`, "Nova Fase" e "Novo Critério" abrindo `FormModal`.
7. Remoção de `stages/new/page.tsx` e `stages/[stageId]/grade-criteria/new/page.tsx` (viram modais); forms movidos para `festivals/[festivalId]/create-stage-form.tsx` e `festivals/[festivalId]/stages/[stageId]/create-grade-criterion-form.tsx`.

## 6. Testes e verificação

- Testes unitários novos para os componentes de fundação: `Modal` (abre/fecha, ESC, click fora), `FormModal` (submit/cancelar), `DataTable` (busca, vazio), `Sidebar` (item ativo, item "em breve" desabilitado), `ThemeToggle` (alterna classe + persiste).
- Specs existentes ajustadas apenas onde caminhos de import mudam (forms movidos) — comportamento e asserções (texto, roles, chamadas de API/router) preservados.
- `vitest` completo + `tsc` + lint ao final.
- Revisão visual manual: `next dev` + Playwright para capturar telas-chave (login, dashboard, lista de festivais, detalhe com modals abertos, dark mode, mobile) antes de reportar como concluído — critério do frontend-design skill (rodar no navegador antes de declarar pronto).

## Fora de escopo

- Construir as telas reais de Inscrições/Classificação/Relatórios/Usuários/Backups — ficam só como itens de menu "em breve" até terem API própria (sub-projetos futuros).
- Migrar dados ou lógica do sistema legado — as capturas de tela serviram só para mapear módulos.
- Dashboard com gráficos/números fabricados — só métricas derivadas de dados reais já buscados.

## Rastreabilidade

- Revisa a seção 3 (Telas) de `docs/specs/2026-09-16-frontend-admin-design.md`; seções 1, 2, 4-6 daquele documento continuam valendo sem alteração.
- Testes que restringem o escopo das mudanças de modal: `festival-detail.spec.tsx`, `create-stage-form.spec.tsx`, `create-grade-criterion-form.spec.tsx`, `admin-festival-flow.spec.ts` (e2e).
- Endpoint reaproveitado sem UI prévia: `PATCH /tenants/:slug/festivals/:id` (`updateFestival`, já implementado no client `src/lib/api/festivals.ts`).
