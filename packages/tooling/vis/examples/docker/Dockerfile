## Multi-stage build that uses `vis docker scaffold` and `vis docker prune`
## to keep the install layer cache-friendly. See README.md for the full flow.

# 1) deps — only manifests + pruned lockfile, so this layer is reused
#    on every source-only change.
FROM node:26.3.1 AS deps
WORKDIR /app
RUN corepack enable
COPY .vis/docker/workspace/ ./
RUN pnpm install --frozen-lockfile

# 2) build — full sources for the focus closure, then build, then prune
#    every project that isn't part of the focus closure.
FROM deps AS build
COPY .vis/docker/sources/ ./
COPY .vis/docker/vis-docker-manifest.json .vis/docker/
RUN pnpm --filter api build
RUN pnpm exec vis docker prune --context=.vis/docker

# 3) runtime — only the focus project's built output and pruned deps.
FROM node:26.3.1
WORKDIR /app
COPY --from=build /app/packages/api ./packages/api
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "packages/api/src/index.js"]
