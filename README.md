## Local Setup

1. `cp .env.example .env` and `cp apps/web/.env.example apps/web/.env.local`
2. `docker compose up -d mysql`
3. `pnpm install`
4. `cd apps/api && pnpm exec prisma migrate deploy && pnpm exec prisma generate && cd ../..`
5. `cd apps/api && pnpm run seed:admin && cd ../..` — creates a tenant (`fenac`) and its first ORGANIZER admin (`admin@fenac.local`), printing a generated password. There is no HTTP endpoint to do this — see `apps/api/scripts/seed-admin.ts` for why.
   - To run the Playwright smoke test, re-seed with a known password: `SEED_ADMIN_PASSWORD=test-password-123 pnpm --filter api run seed:admin` (only works before the admin already exists — the script is idempotent and won't overwrite an existing admin's password).
6. `pnpm --filter api run start:dev` (or `docker compose up api`) and, in another terminal, `pnpm --filter web dev`
7. Open `http://localhost:3000/login` and sign in with the email/password from step 5.

### Alternativa: stack completa via Docker Compose

Em vez dos passos 2 e 6, para rodar tudo (mysql + api + web) em containers:

1. `cp .env.example .env` and `cp apps/web/.env.example apps/web/.env.local`
2. `docker compose up -d --build` — builda e sobe os 3 serviços (`mysql`, `api`, `web`); o container da API aplica `prisma migrate deploy` automaticamente ao iniciar.
3. `cd apps/api && SEED_ADMIN_PASSWORD='sua-senha-aqui' pnpm run seed:admin && cd ../..` — precisa rodar fora do container (ou via `docker compose exec api ...`), já que o seed não é exposto como endpoint HTTP.
4. Abra `http://localhost:3000/login` e entre com `admin@fenac.local` e a senha do passo 3.
