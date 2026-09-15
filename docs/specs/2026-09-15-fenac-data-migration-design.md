# FENAC Platform — Spec de Migração de Dados (Sub-projeto 3)

Status: aprovado, pronto para writing-plans.
Depende de: `2026-09-15-fenac-platform-architecture-design.md` (schema/entidades do novo sistema) e
`docs/discovery/01-data-model.md` (schema real do legado, validado contra dump de produção).

## Contexto

Migração única, do MySQL do `fenac-inscricoes` (FENAC — o outro repositório, `festival-cultural`,
pertence a outro cliente e está fora de escopo) para o schema novo do NestJS. Roda uma única vez,
num corte direto, não uma sincronização contínua.

## 1. Escopo & ordem de migração

Migra somente `fenac-inscricoes`. Ordem respeitando dependências FK:

1. `countries` → `cities`
2. `festivals` → `festival_categories`, `festival_grades` (legado), `instruments`, `festival_cities`
3. `users`, `admins`
4. `inscriptions`
5. `inscription_instrument`, `inscription_impediments`, `inscription_votes` (legado, somente-leitura),
   `inscription_classifieds`, `online_inscription_votes`
6. `files` (cópia física + registro)

Cada tabela migra através dos `Repository`s do novo sistema (camada de infraestrutura da arquitetura
já definida), não via SQL solto — garante que o dado migrado passe pelas mesmas validações de
domínio de um registro criado normalmente.

## 2. Casos especiais

- **Senhas**: Laravel usa bcrypt (`$2y$`); bibliotecas bcrypt do Node leem esse formato (com
  eventual normalização de prefixo para `$2b$`). Migram diretamente — **sem forçar reset** de
  senha dos usuários.
- **`festival_grades`/`inscription_votes` (legado)**: migram como registro histórico
  somente-leitura vinculado à inscrição (visível no histórico do candidato), sem tentar encaixar no
  novo modelo multi-critério — evita dado artificial. Só festivais criados a partir do novo sistema
  usam o modelo de critérios/fases de verdade.
- **`composers_music = '.'`**: normalizado para `null` (era um placeholder de campo vazio no
  legado, não um valor real).
- **`files`**: cópia física do disco legado para o volume do novo `LocalStorageProvider`; cria a
  entidade `File` nova inferindo mimetype/tamanho/dono na cópia, e reaponta as referências
  (`letter_music_id`, `audio_music_id`, `payment_receipt_id`, etc.) para os novos IDs.
- **Festivais 1-47 (1972-2018)**: migram como timeline simples (nome/ano/número), sem inscrições ou
  arquivos associados — não existem operacionalmente no legado (ver `01-data-model.md`).
- **CPFs duplicados/inconsistentes**: um relatório de pré-checagem roda antes da migração real,
  listando duplicatas e CPFs malformados para correção manual pontual — o script não decide sozinho
  o que fazer com dado sujo.

## 3. Validação & rollback

Após a migração, um script de reconciliação compara contagens por tabela (legado vs. novo) e somas
de valores críticos (total de inscrições por festival, total de arquivos, total de usuários). O
MySQL legado nunca é alterado — só lido — então rollback é simplesmente não promover o novo sistema
como produção; não há necessidade de reverter dado nenhum.

## 4. Execução (corte direto)

1. **Dry-run** completo em ambiente de homologação, usando uma cópia do dump real
   (`festi190_inscricoes.sql`), validando contagens e testando manualmente os fluxos críticos
   (login com senha migrada, visualização de inscrição histórica, download de arquivo migrado).
2. **Janela de corte** num fim de semana: sistema legado sai do ar, roda a migração real contra o
   banco de produção, roda a reconciliação.
3. **Go-live** só acontece depois da reconciliação bater; caso contrário, o legado permanece no ar
   e a causa da divergência é investigada antes de tentar novamente.
