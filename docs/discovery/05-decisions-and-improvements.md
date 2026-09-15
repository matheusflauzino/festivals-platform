# 05 — Decisões de Produto & Backlog de Melhorias

Resultado da entrevista de melhorias conduzida sobre o inventário de telas (`03-screens-admin.md` /
`03-screens-participant.md`) e as ambiguidades levantadas na descoberta (`01-data-model.md` /
`02-business-rules.md` / `04-festival-cultural-extras.md`). Este documento é o elo entre o
Sub-projeto 1 (Descoberta) e o Sub-projeto 2 (Spec de Arquitetura).

## Decisões estruturais (afetam o modelo de domínio)

1. **Modelo de nota**: multi-critério ponderado, multi-estágio — adotar o modelo do
   `festival-cultural` (`FestivalGradeType`/`InscriptionVoteGradeType`), não o modelo simples atual
   do `fenac-inscricoes`. `festival_grades` como "nome de cidade" em 2025 foi um workaround manual,
   não uma feature — cidade de apresentação continua sendo `festival_cities`.
2. **Classificação/ranking**: permanece 100% curadoria manual da equipe (staff decide olhando as
   notas como referência). Sem algoritmo automático de corte.
3. **Fases com quota**: adotar o conceito `Type`/`classification_amount` do `festival-cultural` —
   festival define fases (classificatória/semifinal/final) com quantidade máxima de avanço
   configurável por fase.
4. **Papéis de admin**: sistema de papéis (Organizador, Jurado, Comissão) — não mais um único perfil
   admin indiferenciado. Registro de admin passa a ser **só por convite** (organizador convida,
   define papel no convite); sem auto-registro público.
5. **Comprovante de cidadania**: aplica-se à FENAC — upload separado de comprovante para intérprete
   e compositor na inscrição (mesmo mecanismo de `File` já usado para outros documentos).
6. **Restrição geográfica**: continua exclusiva a Minas Gerais para a FENAC, mas implementada como
   configuração por festival/tenant (não mais hardcoded na view) — outros tenants poderão definir
   outra regra ou nenhuma.
7. **CNPJ alfanumérico**: usado no cadastro do Tenant/Organizador (empresa cliente do SaaS) — não no
   cadastro do participante nem na inscrição em si.
8. **Auditoria**: adicionar log de auditoria para ações administrativas sensíveis sobre contas de
   usuário (alteração de email/CPF, reset de senha, exclusão) — ausente hoje no `fenac-inscricoes`,
   presente parcialmente no `festival-cultural` (`AccessLog`/`TransactionLog`). Tratado como
   preocupação arquitetural geral, não feature de tenant.
9. **Pagamento**: reviver checkout online (estava implementado e desativado), trocando o gateway
   legado PagSeguro pela **API PIX do Efí Bank** (link de pagamento), com o pagamento manual por
   depósito/PIX-com-comprovante continuando disponível em paralelo. Desenhado atrás de uma porta
   `PaymentGateway` para permitir ampliar depois para cartão/boleto (o próprio Efí oferece ambos)
   ou trocar de provedor sem afetar os casos de uso.
10. **Backups**: deixam de ser uma tela do admin — viram responsabilidade da infraestrutura (backup
    automático agendado do banco).
11. **Login do participante**: mantém email OU CPF como identidade (não simplificar só para email).
12. **Segurança da votação pública**: dedup passa a considerar **CPF** (não só email), e o token
    anti-fraude previsível (MD5 de id+data) é substituído por um token assinado de verdade (HMAC).

## Backlog de melhorias por módulo (telas)

### Admin
- **Dashboard**: adicionar gráficos de evolução (inscrições, avaliação por fase/cidade) e atalhos de
  ação rápida, mantendo simplicidade onde já funciona.
- **Configuração do festival**: unificar fases, critérios de nota (com peso por fase) e quotas de
  avanço num único fluxo de configuração, em vez de telas de CRUD separadas no menu.
- **Tela de avaliação da inscrição**: mesma URL/tela para todos os papéis, mas com visibilidade
  condicional — jurado vê só música + mídia + formulário de nota; organizador vê tudo (docs, dados
  do candidato, classificação).
- **Busca/triagem de inscrições**: adicionar ações em lote e filtros salvos/presets.
- **Classificados**: mostrar contador "X de Y" por fase e alertar visualmente ao ultrapassar a
  quota, mas sem bloquear — decisão final continua flexível com a equipe.
- **Relatórios**: restaurar o export PDF de votação online (hoje pela metade/desativado), adicionar
  relatórios salvos (reaproveitando a ideia do `SavedReport` do festival-cultural), modernizar
  visual/export dos 4 relatórios existentes.
- **Gestão de usuários (candidatos)**: manter as ações de suporte (reset email/CPF/senha) agora com
  log de auditoria; dar uma UI real para a ferramenta de detecção de duplicados (hoje rota
  escondida sem menu).
- **Backups**: remover do produto — vira infra.

### Participante
- **Login/Auth**: manter email/CPF como identidade de login.
- **Dashboard**: mostrar status das inscrições + contagem regressiva do prazo + espaço para
  notícias/avisos do organizador + CTA claro de nova inscrição.
- **Perfil ("Meus Dados")**: reativar os campos RG e "como conheceu o festival" (hoje presentes no
  código mas desligados).
- **Formulário de nova inscrição**: transformar em wizard multi-etapas (Tipo → Música → Arquivos →
  Pagamento → Confirmação); corrigir a semântica de "Impedimentos" na UI (hoje soa como
  disponibilidade, mas significa indisponibilidade) mantendo o significado de negócio.
- **Pagamento**: reviver checkout online com PIX via Efí Bank (link de pagamento); a tela de recibo
  (hoje um `dd()` de debug quebrado) precisa de uma implementação real de qualquer forma.
- **Votação pública**: aplicar dedup por CPF e substituir o token previsível por um HMAC assinado.

## Itens fora de escopo do lançamento FENAC (confirmado)
Do diff do `festival-cultural` (`04-festival-cultural-extras.md`): distribuição/fila de jurados por
cidade, papéis de comissão de julgamento vs. classificação como flags separadas, segundo prêmio /
ledger de premiação, relatórios salvos como tabela dedicada (a ideia foi absorvida acima, mas sem
precisar da mesma modelagem). Continuam candidatos a features vendáveis para um segundo tenant no
futuro, não para o lançamento inicial.
