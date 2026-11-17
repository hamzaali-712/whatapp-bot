
import { Router } from 'express';

import {
  getQRCode,
  getWhatsAppStatus,
  disconnectWhatsApp,
} from '../whatsapp/client.js';

import {
  sendTextMessage,
  sendImageMessage,
  sendDocumentMessage,
} from '../services/message.service.js';

const router = Router();

// Connection status
router.get('/status', (_req, res) => {
  res.json({
    success: true,
    data: getWhatsAppStatus(),
  });
});

// QR code
router.get('/qr', (_req, res) => {
  const qr = getQRCode();

  if (!qr.qr) {
    return res.status(404).json({
      success: false,
      message: 'QR unavailable. Check connection status.',
    });
  }

  res.json({
    success: true,
    qr: qr.qr,
    qrImage: qr.qrImage,
  });
});

// Send text
router.post('/send', async (req, res, next) => {
  try {
    const { number, message } = req.body;

    if (
      typeof number !== 'string' ||
      typeof message !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Number and message are required.',
      });
    }

    const result = await sendTextMessage(number, message);

    res.json(result);

  } catch (error) {
    next(error);
  }
});

// Send image
router.post('/send-image', async (req, res, next) => {
  try {
    const { number, base64, caption, mimetype } = req.body;

    if (
      typeof number !== 'string' ||
      typeof base64 !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Number and base64 image are required.',
      });
    }

    const result = await sendImageMessage(
      number,
      base64,
      caption,
      mimetype
    );

    res.json(result);

  } catch (error) {
    next(error);
  }
});

// Send document
router.post('/send-document', async (req, res, next) => {
  try {
    const {
      number,
      base64,
      fileName,
      mimetype,
      caption,
    } = req.body;

    if (
      typeof number !== 'string' ||
      typeof base64 !== 'string' ||
      typeof fileName !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Number, base64 and fileName are required.',
      });
    }

    const result = await sendDocumentMessage(
      number,
      base64,
      fileName,
      mimetype,
      caption
    );

    res.json(result);

  } catch (error) {
    next(error);
  }
});

// Disconnect and remove the saved session
router.post('/disconnect', async (_req, res, next) => {
  try {
    await disconnectWhatsApp();

    res.json({
      success: true,
      message: 'WhatsApp disconnected and session removed.',
    });

  } catch (error) {
    next(error);
  }
});

export default router;
