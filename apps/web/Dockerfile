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
# rather than supplied to the running container. These are the addresses the
# *browser* dials, so they name the host's published ports, not container ones.
ARG NEXT_PUBLIC_WS_URL=ws://127.0.0.1:3013/ws/session
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:3013
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
ENV PORT=3012

# Bind every interface *inside the container* — a published port cannot reach a
# process listening only on the container's own loopback. This is not a public
# exposure: the compose files publish to 127.0.0.1 on the host, so the port is
# reachable from this machine and nowhere else.
#
# Set explicitly rather than left to default: Next's standalone server binds
# whatever HOSTNAME holds, and some runtimes populate it with the container's
# own hostname — which is not an address this process can bind.
ENV HOSTNAME=0.0.0.0

# In a workspace, Next nests the standalone bundle under its workspace path and
# hoists the traced node_modules to the bundle root — copy both, preserving the
# layout the generated server.js expects.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Run as the unprivileged user the base image already provides.
USER node

EXPOSE 3012

# Reads PORT inside node rather than interpolating it in the shell, so the probe
# follows an overridden port without any quoting games.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3012)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
