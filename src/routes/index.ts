import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'WhatsApp REST API',
      message: 'The API is running. Use the endpoints below to connect your chatbot backend.',
      endpoints: {
        health: { method: 'GET', path: '/health/live' },
        whatsappStatus: { method: 'GET', path: '/api/whatsapp/status' },
        sendMessage: { method: 'POST', path: '/api/whatsapp/send' },
      },
      authentication: 'All /api/* endpoints require an x-api-key header or Authorization: Bearer token.',
    },
  });
});

export default router;
