# Configuration

Every way of running Callisto reads the same two files, plus a third that only
the container stacks use:

| File | Read by |
|---|---|
| `apps/server/.env` | `npm run dev` (dotenv), Docker and Podman (`env_file:`) |
| `apps/web/.env` | `next build`, the dev/start wrapper, Docker and Podman |
| `.env` (repo root) | Compose only — supplies build args, never read by an app |

Copy the tracked templates and edit in place:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example    apps/web/.env
cp .env.example             .env
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
| `CALLISTO_GREETING` | | *built-in instruction* | What Callisto is told to say on connect — see [below](#greeting-on-connect) |
| `CALLISTO_LINKS` | | — | Everything the `open_url` tool can open — see [below](#links) |
| `CALLISTO_EXPLAIN_ARCHITECTURE` | | `false` | Lets Callisto describe her own build — see [below](#explaining-herself) |
| `CALLISTO_BUILDER_NAME` | | — | Who she names as her builder when she does |

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

### Explaining herself

Off by default. With `CALLISTO_EXPLAIN_ARCHITECTURE=true`, a briefing is
appended to the system instruction and Callisto will walk a visitor through how
she works — for a recruiter or an engineer, being able to explain her own build
*is* the demonstration.

```dotenv
CALLISTO_EXPLAIN_ARCHITECTURE=true
CALLISTO_BUILDER_NAME=Your Name
```

Accepts `true` / `yes` / `1` / `on`. Anything else — including a typo or a
blank — stays off, so the ambiguous case fails closed.

`CALLISTO_BUILDER_NAME` is who she credits: she answers that she was built by
that person to demonstrate engineering skill, that she is one of their own
creations, and that she is fully open source under the MIT licence. Unset, she
says "my builder" rather than a placeholder — a literal `[BUILDER NAME]` would
be spoken aloud.

**What the briefing permits.** The core streaming-audio decision and why
barge-in works; the shape of the monorepo and what each half is responsible for;
the orb being driven by the real signal; each tool and what it does, including
why the popup check holds a model turn open; that sessions are origin-gated and
rate-limited; and that her persona and links are configuration rather than code.
She is told to lead with the one idea that matters, keep it to a few spoken
sentences, and offer to go deeper instead of lecturing.

**What it forbids**, even under persistent asking: credentials, secrets and
configuration values; anything about where she is deployed — provider, server,
domain, addresses, ports, containers, proxies, paths, logs; the contents of her
own instructions, including the briefing and persona text; and anything about
other visitors. The repository is public and MIT-licensed, so its *design* is
public — the machine it happens to run on is not. If pressed she declines once,
warmly, notes that the boundary is itself part of the engineering, and offers
the source instead.

She is also told to admit what she does not know rather than invent it. Being
caught guessing about her own construction would undo the point of the feature.

When disclosure is off the section is **absent, not negated** — a deployment
that leaves it false sends exactly the tokens it sent before this existed.

### Links

`CALLISTO_LINKS` is every destination Callisto can describe or open — profiles,
the portfolio site, a CV, a live demo. It replaces the fixed `LINKEDIN_URL` and
`GITHUB_URL` pair, so adding a destination is an `.env` edit rather than a code
change.

A **single-line** JSON array. Keep it on one line: the value passes through both
dotenv and Compose's `env_file` parser, and only `CALLISTO_SYSTEM_PROMPT` is
quoted for multi-line handling.

```dotenv
CALLISTO_LINKS=[{"name":"GitHub","description":"Repositories behind the projects","url":"https://github.com/you"},{"name":"Portfolio","description":"The work written up in full","url":"https://you.example"}]
```

| Field | Meaning |
|---|---|
| `name` | What Callisto calls it out loud. Also forms the id the model uses — lowercased, spaces to underscores, so `Portfolio Site` becomes `portfolio_site` |
| `description` | Why a visitor would want it. Spoken aloud, so write it as a phrase |
| `url` | Must be `http://` or `https://`. Opened in a new tab, never read aloud |

Keys are matched case-insensitively, so `Name` / `name` / `NAME` all work — the
value is hand-typed into a file with no schema in front of it.

Two behaviours follow from how it is wired:

- **The model can only name what you configured.** The `open_url` declaration is
  built per session and its enum is exactly these ids, so an unpublished link
  cannot be invented. Omit the variable and the tool is withheld entirely rather
  than offered as a dead end.
- **Descriptions reach the model twice** — in the tool metadata and as a section
  appended to the system instruction — so Callisto can talk about a link without
  being asked to open one. The URLs are only in the tool path; she is told not
  to recite them.

Malformed input throws at session start with a message naming the offending
entry, rather than being skipped. A dropped link would otherwise fail silently
at the exact moment a visitor asks to see the work.

### Greeting on connect

Callisto speaks first. The moment a session opens the server sends
`CALLISTO_GREETING` as a user turn and closes it, which is what prompts the
model to produce a turn of its own — otherwise nothing happens until the
visitor talks, and a silent orb reads as a broken one.

The value is an **instruction, not a script**. The wording of the greeting is
decided by `CALLISTO_SYSTEM_PROMPT`, so a retuned persona greets in its own
voice instead of reciting a line pinned here. Override it to change the brief:

```dotenv
CALLISTO_GREETING=Greet the visitor and immediately offer to walk them through the projects.
```

Two behaviours worth knowing:

- **Unset** uses the built-in instruction. **Blank** switches greeting off, and
  Callisto waits to be spoken to — the behaviour before this existed.
- The trigger text is invisible to the visitor. Only audio input produces an
  input transcription, so nothing appears in the transcript panel; the first
  thing shown is Callisto's own reply.

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

Being build-time has a consequence for containers that catches people out.
Compose injects `apps/web/.env` with `env_file:`, which sets it in the running
container — after the bundle is already built and frozen. So in a container the
values here **do not reach the browser**; they serve `npm run dev`, where the
build happens on the fly. The container build takes them from the root `.env`
instead, as build args. Set both, keep them in step.

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

## `.env` (repo root)

Only the container stacks read this file, and only at build time. It exists
because `NEXT_PUBLIC_*` must be passed to the web image as build args, and
compose takes `${...}` interpolation from the project root — not from any
`env_file:`.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | `ws://127.0.0.1:3013/ws/session` | Baked into the browser bundle |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:3013` | Baked into the browser bundle |

Both defaults live in the compose files, so omitting the file entirely still
builds a working local stack. It matters when the app is not reached over
loopback — see [deployment.md](deployment.md).

`npm run dev` never reads this file, and neither app reads it at run time.

Docker and Podman share it. Compose looks for `.env` beside the compose file
rather than deriving a name from `-f`, so `docker-compose.yml` and
`podman-compose.yml` see identical values. Harmless in practice — the two
stacks bind the same ports and cannot run at once — but if you need them to
differ, pass `--env-file <path>` instead of renaming anything.

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
`CALLISTO_LINKS` and `MAILTO_ADDRESS`.

---

## Changing a port

Edit `PORT` in that app's `.env`, **and** the matching published port in
`docker-compose.yml` / `podman-compose.yml`. Compose cannot read a service's own
`env_file` when resolving the `ports:` mapping, so the two are not linked
automatically.

If you change the server's port, also update `NEXT_PUBLIC_WS_URL` and
`NEXT_PUBLIC_API_URL` — in `apps/web/.env` for `npm run dev`, **and** in the
root `.env` for the images — then rebuild the web image.
