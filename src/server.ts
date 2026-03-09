import 'dotenv/config';
import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import { config } from './config';
import { handleSessionWebSocket } from './controllers/session.controller';

const server = http.createServer(app);

// ── WebSocket Server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws/session' });
wss.on('connection', handleSessionWebSocket);

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(config.PORT, () => {
  console.log(`🚀 Callisto API     → http://localhost:${config.PORT}`);
  console.log(`🔌 WebSocket        → ws://localhost:${config.PORT}/ws/session`);
  console.log(`🩺 Health           → http://localhost:${config.PORT}/health`);
  console.log(`ℹ️  Session info     → http://localhost:${config.PORT}/api/v1/session/info`);
});

export default server;
