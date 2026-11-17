
import { Router } from 'express';

import { env } from '../config/env.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({
    success: true,
    configured: Boolean(env.WEBHOOK_URL),
    destination: env.WEBHOOK_URL
      ? new URL(env.WEBHOOK_URL).origin
      : null,
  });
});

router.post('/test', async (_req, res, next) => {
  try {
    if (!env.WEBHOOK_URL) {
      return res.status(400).json({
        success: false,
        error: 'WEBHOOK_URL is not configured.',
      });
    }

    const response = await fetch(env.WEBHOOK_URL, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        ...(env.WEBHOOK_SECRET
          ? { 'x-webhook-secret': env.WEBHOOK_SECRET }
          : {}),
      },

      body: JSON.stringify({
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
      }),

      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: `Webhook returned HTTP ${response.status}`,
      });
    }

    res.json({
      success: true,
      message: 'Webhook delivered successfully.',
    });

  } catch (error) {
    next(error);
  }
});

export default router;
