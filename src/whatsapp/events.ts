import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { logger } from '../config/logger.js';
import { deliverWebhook } from '../services/webhook.service.js';
import { messageStatuses } from '../services/message-status.js';

function textFrom(message: WAMessage): string | null {
  const value = message.message;
  return value?.conversation ?? value?.extendedTextMessage?.text ?? value?.imageMessage?.caption ?? value?.videoMessage?.caption ?? value?.documentMessage?.caption ?? null;
}

export function handleWhatsAppEvents(socket: WASocket): void {
  socket.ev.on('messages.update', (updates) => {
    for (const { key, update } of updates) {
      if (key.id && typeof update.status === 'number') messageStatuses.update(key.id, update.status);
    }
  });
  socket.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      const chatJid = message.key.remoteJid;
      if (!message.message || message.key.fromMe || !chatJid || chatJid === 'status@broadcast') continue;
      const payload = {
        event: 'message.received', timestamp: new Date().toISOString(), messageId: message.key.id ?? null,
        chatJid, sender: message.key.participant ?? chatJid, isGroup: chatJid.endsWith('@g.us'),
        messageType: Object.keys(message.message)[0] ?? 'unknown', text: textFrom(message),
      };
      logger.info({ event: payload.event, messageType: payload.messageType, isGroup: payload.isGroup }, 'incoming WhatsApp message');
      void deliverWebhook(payload).then((delivered) => { if (!delivered) logger.warn({ event: payload.event }, 'incoming webhook was not delivered'); });
    }
  });
}
