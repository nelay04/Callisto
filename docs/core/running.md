# Running Callisto

Three ways to run the same project: [bare](#bare-npm), [Docker](#docker),
[Podman](#podman). All three read the same two `.env` files and serve the same
two ports.

| | Port | Bound to |
|---|---|---|
| `@callisto/web` | `3012` | `127.0.0.1` |
| `@callisto/server` | `3013` | `127.0.0.1` |

Nothing listens on `0.0.0.0` on the host in any mode. Open
<http://127.0.0.1:3012> once it is up.

---

## First, in every mode

```bash
cp apps/server/.env.example apps/server/.env     # then add your GEMINI_API_KEY
cp apps/web/.env.example    apps/web/.env
cp .env.example             .env                 # container stacks only
```

Each app is configured by exactly one file. There is no `.env.local` or
`.env.production` variant — the same file feeds npm, Docker and Podman, so
there is nothing to keep in sync. Only the `.env.example` templates are tracked
by git; `.env` is ignored and never copied into an image.

The third file is different in kind: the root `.env` is read by *compose*, not
by either app, and supplies `NEXT_PUBLIC_WS_URL` and `NEXT_PUBLIC_API_URL` as
**build args**. Next inlines those into the browser bundle at build time, so
the copies in `apps/web/.env` arrive too late to affect a container image —
they serve `npm run dev`, where the build happens on the fly. Skip this copy
and the containers still build, using the loopback defaults in the compose
files. Both stacks read the same root `.env`; compose looks for it beside the
compose file and ignores the `-f` filename.

`apps/server/.env` needs a real
[Gemini API key](https://aistudio.google.com/apikey) before a session will
connect. Everything else ships with a working default, including Callisto's
persona. See [configuration.md](configuration.md).

---

## Bare (npm)

**Requires:** Node 22+.

```bash
npm install
npm run dev
```

Runs both apps with hot reload — `tsx watch` for the server, `next dev` for the
web client.

```bash
npm run dev:server      # just the session server
npm run dev:web         # just the web client
```

For a production-style run without containers:

```bash
npm run build
npm start -w @callisto/server
npm start -w @callisto/web
```

> `apps/web` runs Next through
> [`scripts/next-with-env.mjs`](../../apps/web/scripts/next-with-env.mjs) in
> `dev` and `start`. Next resolves `--port` while parsing argv, before it loads
> any `.env` file, so `PORT` in `.env` would otherwise be ignored. A `PORT`
> exported in your shell still wins over the file.

---

## Docker

**Requires:** Docker with the Compose plugin.

```bash
npm run docker:up        # docker compose up --build
npm run docker:down
```

Useful directly:

```bash
docker compose logs -f server
docker compose ps
docker compose up --build -d          # detached
```

Both images build from the **repo root**, since npm workspaces hoist
`node_modules` above the individual apps — that is why `docker-compose.yml`
lives at the root and sets `context: .`.

The two `.env` files are injected with `env_file:` at run time, never copied
into a layer; `.dockerignore` excludes `.env` precisely so a key cannot end up
in an image.

The stack pins its identity so it does not collide with other projects on a
shared host:

| | Value |
|---|---|
| Project name | `callisto` |
| Network | `callisto_net` |
| Images | `callisto/server:latest`, `callisto/web:latest` |
| Containers | `callisto-server-1`, `callisto-web-1` |

---

## Podman

**Requires:** Podman 5+ (rootless is fine).

```bash
npm run podman:up        # podman compose -f podman-compose.yml up --build
npm run podman:down
```

Both scripts are thin wrappers around the command in the comment. On a host
with no Node installed — a deployment VM, typically — run that command
directly; the images compile the workspaces internally, so nothing outside the
container needs npm. This is what the deploy workflow does, adding `-d`.

`podman compose` delegates to the `docker-compose` binary, which must be on
`PATH`, and needs the Podman API socket running:

```bash
systemctl --user start podman.socket
systemctl --user enable podman.socket     # to survive reboot
```

[`podman-compose.yml`](../../podman-compose.yml) is a separate file rather than
a reuse of the Docker one, and is **not** interchangeable with it —
`network_mode: pasta` is Podman-specific and Docker will reject it.

It is kept distinct from the Docker stack on every axis that could collide:

| | Value |
|---|---|
| Project name | `callisto-podman` |
| Network | none — `pasta`, rootless userspace networking |
| Images | `callisto/server:podman`, `callisto/web:podman` |
| Containers | `callisto-podman-server`, `callisto-podman-web` |

**Why `pasta` and no bridge.** The two services never talk to each other — the
browser is the server's only client — so nothing needs service-name DNS. Losing
the bridge means one less network among the ones already on the host, and no
dependency on netavark's ability to program nftables.

That last point is not theoretical: on kernels without nftables support (WSL2
among them) any Podman **bridge** network fails to start with

```
Error: netavark: nftables error: "nft" did not return successfully while applying ruleset
```

Rootless `pasta` forwards ports in userspace and is unaffected. If you ever add
container-to-container traffic, delete `network_mode: pasta` from both services
to fall back to the default bridge.

Both stacks bind the same two ports, so run one at a time:

```bash
npm run docker:down && npm run podman:up
```

---

## Verifying a run

```bash
curl http://127.0.0.1:3013/health              # {"status":"ok",...}
curl http://127.0.0.1:3013/api/v1/session/info
curl -I http://127.0.0.1:3012/                 # HTTP 200
```

To confirm nothing escaped to the network, this should be **refused**:

```bash
curl --max-time 4 "http://$(hostname -I | awk '{print $1}'):3012/"
```

---

## Troubleshooting

**`netavark: nftables error` on `podman compose up`** — see
[Podman](#podman) above; the shipped file already avoids this.

**`Cannot connect to the Docker daemon at .../podman.sock`** — the Podman
socket is not running: `systemctl --user start podman.socket`.

**`address already in use`** — the other stack, or a stray dev server, still
holds 3012/3013. `npm run docker:down`, `npm run podman:down`, or
`fuser -k 3013/tcp`.

**The orb loads but Callisto never answers** — check
`docker compose logs server`. A missing or invalid `GEMINI_API_KEY` is the
usual cause; note that a *missing* key crashes the server process on the first
WebSocket upgrade rather than failing the session.

**`Missing required environment variable: CALLISTO_SYSTEM_PROMPT`** — `.env` was
not copied, or the multi-line prompt lost its closing quote. See
[configuration.md](configuration.md#the-system-prompt).

**WebSocket rejected with 403** — the browser's origin is not in `CORS_ORIGIN`.
Opening `http://localhost:3012` when only `http://127.0.0.1:3012` is listed is
enough to trigger it; the shipped default lists both.

**Changed the backend URL but the browser still dials the old one** —
`NEXT_PUBLIC_*` are inlined at build time. Rebuild: `npm run docker:up` rebuilds,
`docker compose restart` does not.
