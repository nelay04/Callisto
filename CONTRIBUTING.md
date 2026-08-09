# Contributing

Thanks for taking a look. Issues and pull requests are welcome.

## Getting set up

See the [quickstart](README.md#quickstart), or
[docs/core/running.md](docs/core/running.md) for Docker and Podman. You need
Node 22+ and your own [Gemini API key](https://aistudio.google.com/apikey) —
there is no shared test credential.

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

CI runs exactly these, plus a build of both container images and a parse of
both compose stacks against the tracked `.env.example` files.

It is **manual**, though — the workflow is `workflow_dispatch`-only, so nothing
runs automatically on a push or a pull request. Run the commands above locally,
and start a CI run from the Actions tab when you want the container and compose
checks too. Deployment is manual for the same reason: `Deploy (Docker)` and
`Deploy (Podman)` are separate Actions-tab workflows, and merging never ships
anything on its own.

If you touch `CALLISTO_SYSTEM_PROMPT` in `apps/server/.env.example`, keep it a
single double-quoted value with inner quotes escaped as `\"` — CI asserts the
prompt still survives Compose's `env_file` parser, since a truncated system
prompt has no other visible symptom.

## What the tests cover — and what they don't

Automated tests target pure logic where a bug is silent rather than loud: PCM16
conversion, transcript merging, protocol validation, and WebSocket admission
control. There are deliberately **no** tests that mock the Gemini Live session
— a mock of a streaming audio API tests the mock, not the code.

So anything touching audio or the live session needs a manual pass:

1. `npm run dev`, open <http://127.0.0.1:3012>, allow the microphone.
2. Say something. Confirm you hear a reply and both sides appear in the
   transcript panel as coherent turns, not word-by-word fragments.
3. Talk over Callisto mid-reply. Playback should stop immediately.
4. Ask her to open your GitHub, and to draft an email. Try it once with
   popups blocked — she should tell you they're blocked rather than
   pretending the tab opened.

## Conventions

- TypeScript strict mode; no `any` without a comment explaining why.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- Anything crossing the WebSocket belongs in
  [`packages/protocol`](packages/protocol/src/index.ts), never duplicated into
  an app. Add the variant to the union and let the exhaustiveness checks in
  both switch statements tell you what to implement.

## Reporting a security issue

Please don't open a public issue. Email the address configured in this
project's `MAILTO_ADDRESS`, or use GitHub's private vulnerability reporting.
