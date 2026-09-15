FROM node:22-slim AS build
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
RUN corepack enable && corepack use pnpm@latest
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fenac-platform/contracts run build
RUN pnpm --filter @fenac-platform/api exec prisma generate
RUN pnpm --filter @fenac-platform/api run build

# Runtime stage: pnpm hoists dependencies into a content-addressable store at
# the workspace root (/repo/node_modules/.pnpm), with per-package
# node_modules being symlink farms pointing back into it (and the
# @fenac-platform/contracts workspace package resolved via a symlink to
# packages/contracts). Copying only apps/api/{dist,node_modules,prisma} into
# a flat /app produces dangling symlinks. Preserve the monorepo-relative
# layout instead so every symlink still resolves.
FROM node:22-slim AS runtime
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/contracts ./packages/contracts
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
WORKDIR /repo/apps/api
EXPOSE 3000
# Apply pending Prisma migrations before starting the server, so a fresh
# mysql_data volume gets its schema created automatically on first boot
# instead of requiring a migration to be run by hand out-of-band. The
# `prisma` CLI (a devDependency, not just @prisma/client) is present here
# because the runtime stage copies apps/api/node_modules unpruned.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
