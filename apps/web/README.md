# @callisto/web

The browser client: a Next.js 15 app that captures microphone audio, streams it
to the session server, plays the reply, and drives the reactive orb from the
live audio signal.

Part of the [Callisto monorepo](../../README.md). See
[docs/core/architecture.md](../../docs/core/architecture.md) for how it fits
together and [docs/core/configuration.md](../../docs/core/configuration.md) for
every environment variable.

## Layout

```
src/
├── app/                  Next.js app router — layout, page, global styles
├── components/
│   ├── CallistoOrb.tsx   The orb; driven by volume + pitch, not a timer
│   └── TranscriptPanel.tsx
├── hooks/
│   ├── useVoiceAssistant.ts   Socket, audio graphs, and session state
│   └── useMobile.ts
├── lib/
│   ├── audioUtils.ts     PCM16 ↔ Float32 conversion
│   └── transcript.ts     Folding streaming fragments into turns
└── types/                Frontend-only types; the wire format lives in
                          @callisto/protocol
```

## Audio pipeline

Capture runs at 16 kHz and playback at 24 kHz — two separate `AudioContext`s,
because those are the rates Gemini Live expects on each side. Details in
[docs/core/architecture.md](../../docs/core/architecture.md#audio-pipeline).

## Scripts

```bash
npm run dev -w @callisto/web     # next dev --turbopack, on 127.0.0.1:3012
npm run build -w @callisto/web   # next build --turbopack → standalone output
npm test -w @callisto/web
```

Configured entirely by `apps/web/.env` (copy `.env.example`) — there is no
`.env.local`.

`dev` and `start` run Next through
[`scripts/next-with-env.mjs`](scripts/next-with-env.mjs), which applies `.env`
to the environment first. Next resolves `--port` while parsing argv, before it
loads any `.env` file, so `PORT` in `.env` would otherwise be ignored. `build`
skips the wrapper because Next's own env loading is what inlines
`NEXT_PUBLIC_*`.
