import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './env.js';

const valid = {
  NODE_ENV: 'test', PORT: '5000', API_SECRET: 'a'.repeat(32),
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'key',
  WHATSAPP_SESSION_ID: 'main', AUTH_ENCRYPTION_KEY: 'b'.repeat(64),
  WEBHOOK_URL: '', WEBHOOK_SECRET: '', CORS_ORIGINS: 'http://localhost:3000, http://localhost:5173',
};

describe('environment parsing', () => {
  it('parses valid values and CORS origins', () => {
    expect(parseEnvironment(valid).CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:5173']);
  });
  it('rejects malformed encryption keys', () => {
    expect(() => parseEnvironment({ ...valid, AUTH_ENCRYPTION_KEY: 'nope' })).toThrow();
  });
  it('requires HTTPS webhooks in production', () => {
    expect(() => parseEnvironment({ ...valid, NODE_ENV: 'production', WEBHOOK_URL: 'http://example.com' })).toThrow('HTTPS');
  });
});
