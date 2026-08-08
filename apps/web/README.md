# @callisto/web

The browser client: a Next.js 15 app that captures microphone audio, streams it
to the session server, plays the reply, and drives the reactive orb from the
live audio signal.

Part of the [Callisto monorepo](../../README.md) — start there for setup,
architecture, and configuration.

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
because those are the rates Gemini Live expects on each side. Incoming chunks
are scheduled back-to-back against `nextStartTime` so playback stays gapless,
and an `interrupted` message stops every scheduled source at once.

## Scripts

```bash
npm run dev -w @callisto/web     # next dev --turbopack
npm run build -w @callisto/web   # next build --turbopack → standalone output
npm test -w @callisto/web
```
