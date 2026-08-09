import 'dotenv/config';
import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import { config } from './config';
import { handleSessionWebSocket } from './controllers/session.controller';
import { SessionLimiter, clientIpFrom, isOriginAllowed } from './ws/gate';

const server = http.createServer(app);

// ── WebSocket Server ──────────────────────────────────────────────────────────
// `noServer` so we can reject bad upgrades before a socket is ever established.
const wss = new WebSocketServer({ noServer: true });
const limiter = new SessionLimiter(config.MAX_SESSIONS_PER_IP);

server.on('upgrade', (req, socket, head) => {
  if (req.url?.split('?')[0] !== '/ws/session') {
    socket.destroy();
    return;
  }

  const origin = req.headers.origin;
  if (!isOriginAllowed(origin, config.CORS_ORIGIN)) {
    console.warn(`Rejected WebSocket upgrade from origin: ${origin ?? '(none)'}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  const ip = clientIpFrom(req.headers['x-forwarded-for'], req.socket.remoteAddress);
  if (!limiter.canAccept(ip)) {
    console.warn(`Rejected WebSocket upgrade — session limit reached for ${ip}`);
    socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    limiter.acquire(ip);
    ws.once('close', () => limiter.release(ip));
    handleSessionWebSocket(ws);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(config.PORT, config.HOST, () => {
  // 0.0.0.0 is not a dialable address — print loopback in that case so the
  // logged URLs are ones you can actually paste into a browser.
  const shown = config.HOST === '0.0.0.0' ? '127.0.0.1' : config.HOST;
  const origin = `${shown}:${config.PORT}`;

  console.log(`Callisto API     → http://${origin}`);
  console.log(`WebSocket        → ws://${origin}/ws/session`);
  console.log(`Health           → http://${origin}/health`);
  console.log(`Session info     → http://${origin}/api/v1/session/info`);
  console.log(`Bound to         → ${config.HOST}:${config.PORT}`);
  console.log(`Allowed origins  → ${config.CORS_ORIGIN.join(', ')}`);
});

export default server;
