# Callisto

**A real-time voice assistant you talk to, not type at.** Speak, and Callisto
answers in natural speech with sub-second latency — interrupting her mid-sentence
works the way it does with a person.

[![CI](https://github.com/nelay04/Callisto/actions/workflows/ci.yml/badge.svg)](https://github.com/nelay04/Callisto/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)

<!-- TODO: replace with a recorded GIF of the orb reacting to speech.
     This is the single highest-impact thing missing from this README. -->

---

## What makes it interesting

Most "AI voice assistants" are speech-to-text → LLM → text-to-speech, with a
second or two of latency at each hop. Callisto streams **raw audio in both
directions** over a single WebSocket to the Gemini Live API, so there is no
transcription round-trip in the critical path — the model hears audio and emits
audio.

- **Barge-in works.** Speaking over Callisto stops her playback immediately,
  because the microphone stream never pauses.
- **The orb is driven by the actual signal** — volume and a spectral-centroid
  pitch proxy sampled from both audio graphs at 20 Hz, not a timer.
- **Tools round-trip through the browser.** One of them holds the model's turn
  open until the browser answers.

[**Read the architecture →**](docs/core/architecture.md)

## Quickstart

**Prerequisites:** Node 22+ and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/nelay04/Callisto.git
cd Callisto
npm install

cp apps/server/.env.example apps/server/.env     # add your GEMINI_API_KEY
cp apps/web/.env.example    apps/web/.env

npm run dev
```

Open <http://127.0.0.1:3012>, allow microphone access, and start talking.

Prefer containers? Both stacks read those same two `.env` files, plus a root
`.env` holding the two build-time `NEXT_PUBLIC_*` URLs:

```bash
cp .env.example .env     # optional locally; defaults to loopback
npm run docker:up        # or: npm run podman:up
```

[**Full running guide — bare, Docker, Podman →**](docs/core/running.md)

## Documentation

| | |
|---|---|
| [Architecture](docs/core/architecture.md) | How it fits together, the audio pipeline, tool calling, limitations |
| [Running](docs/core/running.md) | Bare npm, Docker and Podman, plus troubleshooting |
| [Configuration](docs/core/configuration.md) | Every environment variable, and the system prompt |
| [Deployment](docs/core/deployment.md) | nginx, a domain, TLS, what to expose, and the deploy workflows |
| [Contributing](CONTRIBUTING.md) | Tests, conventions, manual QA pass |

## Repository layout

```
callisto/
├── apps/
│   ├── server/          Express + WebSocket bridge to Gemini Live
│   └── web/             Next.js 15 client with the reactive orb
├── packages/
│   └── protocol/        Shared WebSocket message types + validators
└── docs/core/           Architecture, running, configuration, deployment
```

| Workspace | Stack |
|---|---|
| [`@callisto/server`](apps/server) | Node 22, Express 4, `ws`, `@google/genai` |
| [`@callisto/web`](apps/web) | Next.js 15, React 19, Tailwind 4, Motion |
| [`@callisto/protocol`](packages/protocol) | Zero-dependency TypeScript |

## Ports

| | Port | Bound to |
|---|---|---|
| [`@callisto/web`](apps/web) | `3012` | `127.0.0.1` |
| [`@callisto/server`](apps/server) | `3013` | `127.0.0.1` |

Everything listens on loopback rather than `0.0.0.0`, in every mode — the
compose files publish as `127.0.0.1:3012:3012`, so nothing is reachable from the
network. In production a single nginx block fronts both on one domain; see
[deployment.md](docs/core/deployment.md).

## Development

```bash
npm run dev         # both apps, with hot reload
npm run typecheck   # tsc --noEmit across all workspaces
npm run lint        # ESLint
npm test            # Vitest
npm run build       # production build of all three workspaces
```

Tests cover the pure logic where a silent bug would be hardest to spot by hand:
the PCM16 encode/decode round-trip, transcript-turn merging, protocol
validation, WebSocket admission control, and system-prompt loading. Audio
playback and the Gemini session itself are verified by hand — see
[CONTRIBUTING.md](CONTRIBUTING.md).

Every workflow is manual, started from the Actions tab. `CI` runs the commands
above plus a container build and a compose parse; `Deploy (Docker)` and
`Deploy (Podman)` ship `main` to the VM over SSH. Nothing runs on push, and
merging never deploys on its own — see
[deployment.md](docs/core/deployment.md#shipping-updates).

## Making it yours

Callisto's persona is deliberately specific — she's named for both Jupiter's
outermost Galilean moon and the Greek huntress, and she introduces herself as
a portfolio companion.

Her entire personality is one environment variable,
`CALLISTO_SYSTEM_PROMPT` in `apps/server/.env`. Rewrite it, set your own
`CALLISTO_LINKS` and `MAILTO_ADDRESS`, and restart — no recompile
and no image rebuild. See
[configuration.md](docs/core/configuration.md#the-system-prompt) for the
multi-line formatting rules.

## License

[MIT](LICENSE) © Nelay Karmakar
