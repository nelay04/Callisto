import express from 'express';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/error.handler';
import { registerRoutes } from './routes';

const app = express();

// ── Core Middleware ──────────────────────────────────────────────────────────
app.use(corsMiddleware);
app.use(express.json());

// ── Health Check ─────────────────────────────────────────────────────────────
// Deliberately echoes no configuration — this endpoint is publicly reachable.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
registerRoutes(app);

// ── Error Handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

export default app;
