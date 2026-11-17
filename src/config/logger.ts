import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.x-api-key',
      'authorization',
      'apiKey',
      'API_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
      'AUTH_ENCRYPTION_KEY',
      'WEBHOOK_SECRET',
      'qr',
      'qrCode',
      'message',
      'body.message',
      'body.base64',
      'body.qr',
    ],
    censor: '[REDACTED]',
  },
});
