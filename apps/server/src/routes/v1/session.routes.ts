import { Router } from 'express';
import { GEMINI_MODEL } from '../../config/gemini';

const router = Router();

/**
 * GET /api/v1/session/info
 * Returns public metadata about the assistant — useful for the frontend to
 * display branding and capability information before a session starts.
 */
router.get('/info', (_req, res) => {
  res.json({
    assistant: {
      name: 'Callisto',
      model: GEMINI_MODEL,
      capabilities: ['voice', 'realtime-audio', 'transcription'],
    },
    websocket: {
      path: '/ws/session',
      protocol: 'JSON over WebSocket',
    },
  });
});

export default router;
