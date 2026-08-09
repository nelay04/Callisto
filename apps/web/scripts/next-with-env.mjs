#!/usr/bin/env node
/**
 * Runs the Next.js CLI with apps/web/.env already applied to process.env.
 *
 * Next reads `--port` from the environment while it parses argv, which happens
 * before it loads any .env file. So `PORT` in .env is invisible to `next dev`
 * and `next start` unless something puts it into the real environment first —
 * that is this script's entire job. (Next does load .env itself for
 * NEXT_PUBLIC_* inlining during a build, which is why `build` runs the CLI
 * directly and skips this wrapper.)
 *
 * Variables already exported in the environment take precedence over the file,
 * so the containers — which receive PORT from compose — are unaffected.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

await import('next/dist/bin/next');
