# Build context is the repo ROOT, not this directory — npm workspaces hoist
# node_modules, so the install needs the root manifest and lockfile.
#
#   docker build -f apps/server/Dockerfile .

# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy manifests first so the install layer caches independently of source.
COPY package.json package-lock.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# --ignore-scripts skips the root `prepare` hook, which builds the protocol
# package before its sources have been copied in.
RUN npm ci --ignore-scripts

COPY packages/protocol ./packages/protocol
COPY apps/server ./apps/server

RUN npm run build -w @callisto/protocol \
 && npm run build -w @callisto/server

# Drop dev dependencies from the tree we are about to copy forward.
RUN npm prune --omit=dev

# ── Production stage ────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3013

# Bind every interface *inside the container* — a published port cannot reach a
# process listening only on the container's own loopback. This is not a public
# exposure: the compose files publish to 127.0.0.1 on the host, so the port is
# reachable from this machine and nowhere else.
ENV HOST=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/protocol/dist ./packages/protocol/dist
COPY --from=builder /app/packages/protocol/package.json ./packages/protocol/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/

# Run as the unprivileged user the base image already provides.
USER node

EXPOSE 3013

# Reads PORT inside node rather than interpolating it in the shell, so the probe
# follows an overridden port without any quoting games.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3013)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/dist/server.js"]
