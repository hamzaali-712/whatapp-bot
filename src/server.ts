
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';

import healthRoutes from './routes/health.js';
import whatsappRoutes from './routes/whatsapp.js';
import webhookRoutes from './routes/webhook.js';

import { authenticateAPI } from './middleware/auth.js';

import { startWhatsApp } from './whatsapp/client.js';

const app = express();

// Basic security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGINS.length
      ? env.CORS_ORIGINS
      : false,
    methods: ['GET', 'POST'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
    ],
  })
);

// Request parsing
app.use(express.json({ limit: '12mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});

// Health check (public)
app.use('/health', healthRoutes);

// Protected API
app.use('/api', apiLimiter);

app.use(
  '/api/whatsapp',
  authenticateAPI,
  whatsappRoutes
);

app.use(
  '/api/webhook',
  authenticateAPI,
  webhookRoutes
);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found.',
  });
});

// Central error handler
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('API Error:', error.message);

    if (res.headersSent) return;

    res.status(500).json({
      success: false,
      error:
        env.NODE_ENV === 'production'
          ? 'Internal server error.'
          : error.message,
    });
  }
);

// Start server
const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log('----------------------------------');
  console.log(' WhatsApp API Server Started');
  console.log('----------------------------------');
  console.log(`Port: ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Health: http://localhost:${env.PORT}/health`);
  console.log('----------------------------------');

  // Start WhatsApp in the background.
  void startWhatsApp().catch((error) => {
    console.error('WhatsApp startup error:', error);
  });
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down server...');

  server.close(() => {
    console.log('HTTP server closed.');
  });

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
