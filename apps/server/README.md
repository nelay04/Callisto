# @callisto/server

The session server: an Express app plus a WebSocket endpoint that bridges the
browser to the Gemini Live API. It exists to keep the API key off the client,
gate who may open a session, and run tool calls server-side.

Part of the [Callisto monorepo](../../README.md). See
[docs/core/architecture.md](../../docs/core/architecture.md) for how it fits
together and [docs/core/configuration.md](../../docs/core/configuration.md) for
every environment variable.

## Layout

```
src/
├── server.ts             HTTP + WebSocket entrypoint, upgrade admission control
├── app.ts                Express app and /health
├── config/               Env parsing; Gemini Live connection config
├── controllers/          One WebSocket connection ↔ one Gemini session
├── services/             GeminiService — wraps a single Live session
├── tools/                Function declarations the model can call
├── prompts/              Loads the persona from CALLISTO_SYSTEM_PROMPT; the
│                         prompt text itself lives in .env
├── ws/                   Origin allow-list and per-IP session limiting
└── middleware/           CORS, error handling
```

## Endpoints

| | |
|---|---|
| `GET /health` | Liveness probe. Returns status and uptime only. |
| `GET /api/v1/session/info` | Public metadata about the assistant. |
| `WS /ws/session` | The session socket. Requires an allowed `Origin`. |

## Scripts

```bash
npm run dev -w @callisto/server     # tsx watch
npm run build -w @callisto/server   # tsc → dist/
npm test -w @callisto/server
```

Configured entirely by `apps/server/.env` (copy `.env.example`) — the same file
the Docker and Podman stacks inject. Listens on `127.0.0.1:3013` by default;
`HOST` and `PORT` change that, and the container images override `HOST` to
`0.0.0.0` so their published port is reachable.
