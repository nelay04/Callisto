# Configuration

Every way of running Callisto reads the same two files:

| File | Read by |
|---|---|
| `apps/server/.env` | `npm run dev` (dotenv), Docker and Podman (`env_file:`) |
| `apps/web/.env` | `next build`, the dev/start wrapper, Docker and Podman |

Copy the tracked templates and edit in place:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example    apps/web/.env
```

There is deliberately no `.env.local`, `.env.development` or `.env.production`
variant. One file per app means nothing to keep in sync and one place to look.
`.env` is git-ignored and excluded by `.dockerignore`, so a key never reaches a
commit or an image layer.

---

## `apps/server/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | [Gemini API credential](https://aistudio.google.com/apikey) |
| `MAILTO_ADDRESS` | ✅ | — | Where the `send_mailto` tool addresses drafts |
| `CALLISTO_SYSTEM_PROMPT` | ✅ | *ships filled in* | Callisto's persona — see [below](#the-system-prompt) |
| `GEMINI_MODEL` | | `gemini-2.5-flash-native-audio-preview-12-2025` | Must support the Live API with native audio |
| `PORT` | | `3013` | |
| `HOST` | | `127.0.0.1` | Interface to bind; the images override to `0.0.0.0` |
| `NODE_ENV` | | `development` | |
| `CORS_ORIGIN` | | `http://127.0.0.1:3012,http://localhost:3012` | Comma-separated; gates CORS **and** WebSocket upgrades |
| `MAX_SESSIONS_PER_IP` | | `3` | Concurrent Gemini sessions per client IP |
| `LINKEDIN_URL` / `GITHUB_URL` | | — | Targets for the `open_url` tool; omit one and Callisto says that profile isn't available |

### `HOST`, and why containers use `0.0.0.0`

`HOST` defaults to loopback so a dev server is never silently exposed to the
LAN. The container images set `HOST=0.0.0.0`, and have to: a published port
cannot reach a process bound to the container's *own* private loopback.

That is not a public exposure. The loopback guarantee is enforced on the host
side of the mapping — both compose files publish as `127.0.0.1:3013:3013`, so
the port is reachable from that machine and nowhere else.

### `CORS_ORIGIN`

The browser sends whichever spelling you typed in the address bar, so the
default lists both `127.0.0.1` and `localhost`. In production this becomes your
single public origin — see [deployment.md](deployment.md).

---

## `apps/web/.env`

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3012` | Port the Next.js server listens on |
| `NEXT_PUBLIC_WS_URL` | `ws://127.0.0.1:3013/ws/session` | Session socket |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:3013` | REST base URL — currently unused by application code; kept for the REST endpoints |

### `NEXT_PUBLIC_*` are build-time

They are **inlined into the bundle at build time**, not read at run time. An
image must be *rebuilt* to point at a different backend — restarting does
nothing. They are also the address the **browser** dials, which is why they
never name a compose service: a container hostname means nothing to a browser.

### `PORT` needs a wrapper

Next resolves `--port` from the environment while parsing argv, which happens
*before* it loads any `.env` file. `PORT` in `.env` would therefore be invisible
to `next dev` and `next start`.

[`scripts/next-with-env.mjs`](../../apps/web/scripts/next-with-env.mjs) applies
`.env` first and then hands off to the Next CLI. Variables already exported in
the environment take precedence over the file, so the containers — which get
`PORT` from Compose — are unaffected. `build` skips the wrapper, because Next's
own env loading is what inlines `NEXT_PUBLIC_*`.

---

## The system prompt

`CALLISTO_SYSTEM_PROMPT` holds Callisto's entire persona. It lives in the
environment rather than in TypeScript, so retuning her needs neither a
recompile nor an image rebuild — edit `.env`, restart the server, and the next
session picks it up.

It is a multi-line `.env` value, so two formatting rules apply:

- Wrap the whole prompt in **double quotes**; it may span as many lines as you
  like, blank lines included. The closing quote goes on its own line.
- Escape any double quote *inside* the text as `\"`.

```dotenv
CALLISTO_SYSTEM_PROMPT="You are Callisto — a voice AI assistant.

Her name means \"most beautiful\".
"
```

> **Why the escaping matters.** Compose's `env_file` parser resolves `\"` into
> `"` before the value reaches the process; dotenv, used by `npm run dev`, does
> not. [`callisto.prompt.ts`](../../apps/server/src/prompts/callisto.prompt.ts)
> normalises escapes on read so both paths converge on the same prompt —
> without it, your containers and your dev server would run subtly different
> personas from the same file. CI asserts the prompt still survives Compose's
> parser, because a truncated system prompt has no other visible symptom.

To repurpose the project entirely, rewrite this value and set your own
`LINKEDIN_URL`, `GITHUB_URL` and `MAILTO_ADDRESS`.

---

## Changing a port

Edit `PORT` in that app's `.env`, **and** the matching published port in
`docker-compose.yml` / `podman-compose.yml`. Compose cannot read a service's own
`env_file` when resolving the `ports:` mapping, so the two are not linked
automatically.

If you change the server's port, also update `NEXT_PUBLIC_WS_URL` and
`NEXT_PUBLIC_API_URL` in `apps/web/.env` and rebuild the web image.
