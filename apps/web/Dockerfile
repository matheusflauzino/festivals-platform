FROM node:22-slim AS build
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web ./apps/web
RUN corepack enable && corepack use pnpm@latest
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fenac-platform/web run build

# Runtime stage: same reasoning as apps/api/Dockerfile — pnpm's dependencies
# live in a content-addressable store at the workspace root
# (/repo/node_modules/.pnpm) and apps/web/node_modules is a symlink farm
# pointing back into it, so the monorepo-relative layout must be preserved.
# We also invoke the `next` binary directly instead of `pnpm start` because
# the runtime image never installs pnpm itself (only Corepack was used in
# the build stage, which is discarded here).
FROM node:22-slim AS runtime
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/web/.next ./apps/web/.next
COPY --from=build /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/package.json ./apps/web/package.json
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
