import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { deliverWebhook } from './webhook.service.js';

const originalUrl = env.WEBHOOK_URL;
const originalSecret = env.WEBHOOK_SECRET;

afterEach(() => {
  env.WEBHOOK_URL = originalUrl;
  env.WEBHOOK_SECRET = originalSecret;
  vi.unstubAllGlobals();
});

describe('webhook delivery', () => {
  it('signs and delivers a JSON payload', async () => {
    env.WEBHOOK_URL = 'https://webhook.example.test/events';
    env.WEBHOOK_SECRET = 'secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const payload = { event: 'message.received', messageId: 'abc' };
    await expect(deliverWebhook(payload)).resolves.toBe(true);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.stringify(payload);
    expect(request.headers).toMatchObject({ 'x-webhook-signature-256': `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}` });
  });

  it('does not deliver when no URL is configured', async () => {
    env.WEBHOOK_URL = undefined;
    await expect(deliverWebhook({ event: 'message.received' })).resolves.toBe(false);
  });
});
