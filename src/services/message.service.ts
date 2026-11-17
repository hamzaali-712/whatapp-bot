
import { getSocket } from '../whatsapp/client.js';

function getWhatsAppNumber(number: string): string {
  const cleaned = number.replace(/[\s+\-()]/g, '');

  if (!/^\d{8,15}$/.test(cleaned)) {
    throw new Error('Invalid phone number. Use international format.');
  }

  return `${cleaned}@s.whatsapp.net`;
}

function getConnectedSocket() {
  const sock = getSocket();

  if (!sock) {
    throw new Error('WhatsApp is not connected.');
  }

  return sock;
}

export async function sendTextMessage(
  number: string,
  message: string
) {
  const sock = getConnectedSocket();

  if (!message.trim()) {
    throw new Error('Message cannot be empty.');
  }

  if (message.length > 4000) {
    throw new Error('Message is too long.');
  }

  const jid = getWhatsAppNumber(number);

  const result = await sock.sendMessage(jid, {
    text: message,
  });

  return {
    success: true,
    messageId: result?.key.id || null,
    recipient: jid,
  };
}

function decodeBase64(data: string): Buffer {
  const base64 = data.replace(/^data:[^;]+;base64,/, '');

  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('Invalid base64 data.');
  }

  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
    throw new Error('File must be between 1 byte and 8 MB.');
  }

  return buffer;
}

export async function sendImageMessage(
  number: string,
  base64: string,
  caption?: string,
  mimetype = 'image/jpeg'
) {
  const sock = getConnectedSocket();

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (!allowedTypes.includes(mimetype)) {
    throw new Error('Unsupported image format.');
  }

  const jid = getWhatsAppNumber(number);

  const result = await sock.sendMessage(jid, {
    image: decodeBase64(base64),
    caption,
    mimetype,
  });

  return {
    success: true,
    messageId: result?.key.id || null,
    recipient: jid,
  };
}

export async function sendDocumentMessage(
  number: string,
  base64: string,
  fileName: string,
  mimetype = 'application/pdf',
  caption?: string
) {
  const sock = getConnectedSocket();

  if (
    !fileName ||
    fileName.length > 150 ||
    /[\\/]/.test(fileName)
  ) {
    throw new Error('Invalid document filename.');
  }

  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (!allowedTypes.includes(mimetype)) {
    throw new Error('Unsupported document format.');
  }

  const jid = getWhatsAppNumber(number);

  const result = await sock.sendMessage(jid, {
    document: decodeBase64(base64),
    fileName,
    mimetype,
    caption,
  });

  return {
    success: true,
    messageId: result?.key.id || null,
    recipient: jid,
  };
}
