# @callisto/server

The session server: an Express app plus a WebSocket endpoint that bridges the
browser to the Gemini Live API. It exists to keep the API key off the client,
gate who may open a session, and run tool calls server-side.

Part of the [Callisto monorepo](../../README.md) — start there for setup,
architecture, and configuration.

## Layout

```
src/
├── server.ts             HTTP + WebSocket entrypoint, upgrade admission control
├── app.ts                Express app and /health
├── config/               Env parsing; Gemini Live connection config
├── controllers/          One WebSocket connection ↔ one Gemini session
├── services/             GeminiService — wraps a single Live session
├── tools/                Function declarations the model can call
├── prompts/              Callisto's system prompt and persona
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
