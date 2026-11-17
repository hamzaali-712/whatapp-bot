import { Router } from 'express';
import { getWhatsAppStatus } from '../whatsapp/client.js';

const router = Router();

router.get('/live', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'live',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

router.get('/ready', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ready',
      whatsapp: getWhatsAppStatus(),
    },
  });
});

export default router;
