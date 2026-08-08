# Build context is the repo ROOT, not this directory — npm workspaces hoist
# node_modules, so the install needs the root manifest and lockfile.
#
#   docker build -f apps/web/Dockerfile .

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
COPY apps/web ./apps/web

# NEXT_PUBLIC_* values are inlined at build time, so they must be present here
# rather than supplied to the running container.
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build -w @callisto/protocol \
 && npm run build -w @callisto/web

# ── Production stage ────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# In a workspace, Next nests the standalone bundle under its workspace path and
# hoists the traced node_modules to the bundle root — copy both, preserving the
# layout the generated server.js expects.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Run as the unprivileged user the base image already provides.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
