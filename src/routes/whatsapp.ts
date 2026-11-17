import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { disconnectWhatsApp, getQRCode, getWhatsAppStatus } from '../whatsapp/client.js';
import { ApiError } from '../middleware/errors.js';
import { sendDocumentMessage, sendImageMessage, sendTextMessage } from '../services/message.service.js';
import { messageStatuses } from '../services/message-status.js';

const router = Router();
function routeLimiter(limit: number) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      requestId: res.locals.requestId,
    }),
  });
}
const qrLimiter = routeLimiter(10);
const sendLimiter = routeLimiter(20);
const logoutLimiter = routeLimiter(5);
const recipient = z.string().trim().min(8).max(20);
const textSchema = z.object({ number: recipient, message: z.string().trim().min(1).max(4_000) });
const imageSchema = z.object({ number: recipient, base64: z.string().min(1), caption: z.string().max(1_024).optional(), mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp']) });
const documentSchema = z.object({ number: recipient, base64: z.string().min(1), fileName: z.string().min(1).max(150).regex(/^[^\\/]+$/), caption: z.string().max(1_024).optional(), mimetype: z.enum(['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError(400, 'INVALID_REQUEST', 'Request body is invalid.');
  return result.data;
}

router.get('/status', (_req, res) => res.json({ success: true, data: getWhatsAppStatus() }));
router.get('/messages/:messageId', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const receipt = messageStatuses.get(String(req.params.messageId));
  if (!receipt) throw new ApiError(404, 'MESSAGE_STATUS_UNAVAILABLE', 'Message is unknown, expired, or from a previous process.');
  res.json({ success: true, data: receipt });
});
router.get('/qr', qrLimiter, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const qrDataUrl = getQRCode();
  if (!qrDataUrl) throw new ApiError(404, 'QR_UNAVAILABLE', 'QR unavailable. Check connection status.');
  res.json({ success: true, data: { qrDataUrl } });
});
router.post('/send', sendLimiter, async (req, res, next) => {
  try { const data = parse(textSchema, req.body); res.status(202).json({ success: true, data: await sendTextMessage(data.number, data.message) }); } catch (error) { next(error); }
});
router.post('/send-image', sendLimiter, async (req, res, next) => {
  try { const data = parse(imageSchema, req.body); res.status(202).json({ success: true, data: await sendImageMessage(data.number, data.base64, data.caption, data.mimetype) }); } catch (error) { next(error); }
});
router.post('/send-document', sendLimiter, async (req, res, next) => {
  try { const data = parse(documentSchema, req.body); res.status(202).json({ success: true, data: await sendDocumentMessage(data.number, data.base64, data.fileName, data.caption, data.mimetype) }); } catch (error) { next(error); }
});
router.post('/logout', logoutLimiter, async (_req, res, next) => {
  try { await disconnectWhatsApp(); res.json({ success: true, data: { status: 'logged_out' } }); } catch (error) { next(error); }
});

export default router;
