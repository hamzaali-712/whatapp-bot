import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export async function deliverWebhook(payload: Record<string, unknown>): Promise<boolean> {
  if (!env.WEBHOOK_URL) return false;
  const body = JSON.stringify(payload);
  const signature = env.WEBHOOK_SECRET ? createHmac('sha256', env.WEBHOOK_SECRET).update(body).digest('hex') : undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(env.WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json', ...(signature ? { 'x-webhook-signature-256': `sha256=${signature}` } : {}) }, body, signal: AbortSignal.timeout(10_000) });
      if (response.ok) return true;
      logger.warn({ attempt, status: response.status }, 'webhook delivery failed');
    } catch (error) { logger.warn({ err: error, attempt }, 'webhook delivery failed'); }
    if (attempt < 3) await new Promise<void>((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
  }
  return false;
}
