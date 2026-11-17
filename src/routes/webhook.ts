import { Router } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/errors.js';
import { deliverWebhook } from '../services/webhook.service.js';

const router = Router();
router.get('/status', (_req, res) => res.json({ success: true, data: { configured: Boolean(env.WEBHOOK_URL) } }));
router.post('/test', async (_req, res, next) => {
  try {
    if (!env.WEBHOOK_URL) throw new ApiError(400, 'WEBHOOK_NOT_CONFIGURED', 'WEBHOOK_URL is not configured.');
    const delivered = await deliverWebhook({ event: 'webhook.test', timestamp: new Date().toISOString() });
    if (!delivered) throw new ApiError(502, 'WEBHOOK_DELIVERY_FAILED', 'Webhook delivery failed.');
    res.json({ success: true, data: { status: 'accepted' } });
  } catch (error) { next(error); }
});
export default router;
