import type { AnyMessageContent, WASocket } from '@whiskeysockets/baileys';
import { ApiError } from '../middleware/errors.js';
import { getSocket, getWhatsAppStatus } from '../whatsapp/client.js';

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

function connectedSocket(): WASocket {
  const socket = getSocket();
  if (!socket || !getWhatsAppStatus().connected) throw new ApiError(503, 'WHATSAPP_NOT_CONNECTED', 'WhatsApp is not connected.');
  return socket;
}

export function numberToJid(number: string): string {
  const normalized = number.replace(/[\s+()\-]/g, '');
  if (!/^\d{8,15}$/.test(normalized)) throw new ApiError(400, 'INVALID_RECIPIENT', 'Use an E.164-style phone number.');
  return `${normalized}@s.whatsapp.net`;
}

export function decodeBase64(data: string): Buffer {
  const payload = data.replace(/^data:[^;]+;base64,/, '');
  if (!payload || payload.length > Math.ceil(MAX_MEDIA_BYTES * 4 / 3) || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    throw new ApiError(400, 'INVALID_MEDIA', 'Media must be valid Base64 and at most 8 MB.');
  }
  const result = Buffer.from(payload, 'base64');
  if (result.length === 0 || result.length > MAX_MEDIA_BYTES) throw new ApiError(400, 'INVALID_MEDIA', 'Media must be between 1 byte and 8 MB.');
  return result;
}

async function submit(number: string, content: AnyMessageContent): Promise<{ messageId: string | null; status: 'accepted' }> {
  const socket = connectedSocket();
  const jid = numberToJid(number);
  const registration = await socket.onWhatsApp(jid);
  if (!registration?.some((entry) => entry.exists === true)) throw new ApiError(400, 'RECIPIENT_NOT_ON_WHATSAPP', 'Recipient is not registered on WhatsApp.');
  const sent = await socket.sendMessage(jid, content);
  return { messageId: sent?.key.id ?? null, status: 'accepted' };
}

export function sendTextMessage(number: string, message: string) {
  return submit(number, { text: message });
}

export function sendImageMessage(number: string, base64: string, caption: string | undefined, mimetype: 'image/jpeg' | 'image/png' | 'image/webp') {
  return submit(number, { image: decodeBase64(base64), caption, mimetype });
}

export function sendDocumentMessage(number: string, base64: string, fileName: string, caption: string | undefined, mimetype: string) {
  return submit(number, { document: decodeBase64(base64), fileName, caption, mimetype });
}
