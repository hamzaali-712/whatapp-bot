import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { authenticateAPI } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requestId } from './middleware/request-id.js';
import healthRoutes from './routes/health.js';
import webhookRoutes from './routes/webhook.js';
import whatsappRoutes from './routes/whatsapp.js';
import { startWhatsApp, stopWhatsApp } from './whatsapp/client.js';

const app = express();
let shuttingDown = false;

app.disable('x-powered-by');
app.use(requestId);
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
}));
app.use(express.json({ limit: '12mb' }));

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      requestId: res.locals.requestId,
    });
  },
});

app.use('/health', healthRoutes);
app.use('/api', apiLimiter);
app.use('/api/whatsapp', authenticateAPI, whatsappRoutes);
app.use('/api/webhook', authenticateAPI, webhookRoutes);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'HTTP server started');
  void startWhatsApp().catch((error: unknown) => {
    logger.error({ err: error }, 'WhatsApp startup failed');
  });
});

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'graceful shutdown started');

  const forcedExit = setTimeout(() => {
    logger.error('graceful shutdown timed out');
    process.exit(1);
  }, 25_000);
  forcedExit.unref();

  try {
    await stopWhatsApp();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    logger.info('graceful shutdown completed');
    process.exitCode = 0;
  } catch (error) {
    logger.error({ err: error }, 'graceful shutdown failed');
    process.exitCode = 1;
  } finally {
    clearTimeout(forcedExit);
  }
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
