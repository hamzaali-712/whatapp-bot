import { Router } from 'express';
import { getWhatsAppStatus } from '../whatsapp/client.js';
import { isAuthStorageReady } from '../whatsapp/auth.js';

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

router.get('/ready', async (_req, res) => {
  const storageReady = await isAuthStorageReady();
  res.status(storageReady ? 200 : 503).json({
    success: storageReady,
    data: {
      status: storageReady ? 'ready' : 'not_ready',
      authStorage: storageReady ? 'available' : 'unavailable',
      whatsapp: getWhatsAppStatus(),
    },
  });
});

export default router;
