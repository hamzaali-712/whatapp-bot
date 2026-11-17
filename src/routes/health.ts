
import { Router } from 'express';

import { getWhatsAppStatus } from '../whatsapp/client.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'WhatsApp API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    whatsapp: getWhatsAppStatus(),
  });
});

export default router;
