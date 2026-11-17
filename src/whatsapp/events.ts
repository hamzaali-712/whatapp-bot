
import type { WASocket, WAMessage } from '@whiskeysockets/baileys';

import { env } from '../config/env.js';

function extractText(message: WAMessage): string | null {
  const content = message.message;

  if (!content) return null;

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    null
  );
}

async function sendWebhook(payload: Record<string, unknown>) {
  if (!env.WEBHOOK_URL) return;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(env.WEBHOOK_URL, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          ...(env.WEBHOOK_SECRET
            ? { 'x-webhook-secret': env.WEBHOOK_SECRET }
            : {}),
        },

        body: JSON.stringify(payload),

        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned HTTP ${response.status}`);
      }

      return;

    } catch (error) {
      console.error(`Webhook attempt ${attempt} failed:`, error);

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  console.error('Webhook delivery failed after 3 attempts.');
}

export function handleWhatsAppEvents(sock: WASocket) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      if (!message.message || message.key.fromMe) continue;

      const remoteJid = message.key.remoteJid;

      if (!remoteJid || remoteJid === 'status@broadcast') continue;

      const text = extractText(message);

      const payload = {
        event: 'message.received',

        timestamp: new Date().toISOString(),

        messageId: message.key.id || null,

        from: remoteJid,

        participant: message.key.participant || null,

        isGroup: remoteJid.endsWith('@g.us'),

        pushName: message.pushName || null,

        text,

        messageType: Object.keys(message.message)[0] || 'unknown',
      };

      console.log('Incoming WhatsApp message:', {
        from: remoteJid,
        type: payload.messageType,
      });

      await sendWebhook(payload);
    }
  });

  sock.ev.on('messages.update', (updates) => {
    for (const update of updates) {
      console.log('Message status updated:', update.key.id);
    }
  });

  sock.ev.on('contacts.upsert', (contacts) => {
    console.log(`Contacts synchronized: ${contacts.length}`);
  });
}
