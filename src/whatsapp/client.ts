
import makeWASocket, {
  DisconnectReason,
} from '@whiskeysockets/baileys';

import type { WASocket } from '@whiskeysockets/baileys';

import { Boom } from '@hapi/boom';

import pino from 'pino';

import QRCode from 'qrcode';

import { createAuthState, clearAuthState } from './auth.js';

import { handleWhatsAppEvents } from './events.js';

const logger = pino({ level: 'silent' });

let socket: WASocket | null = null;

let qrCode: string | null = null;

let qrImage: string | null = null;

let connecting = false;

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

let connectionStatus:
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'logged_out' = 'disconnected';

let lastConnected: string | null = null;

let lastError: string | null = null;

export function getSocket(): WASocket | null {
  return socket;
}

export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    connected: connectionStatus === 'connected',
    lastConnected,
    lastError,
    hasQR: Boolean(qrCode),
  };
}

export function getQRCode() {
  return {
    qr: qrCode,
    qrImage,
  };
}

export async function startWhatsApp(): Promise<void> {
  if (connecting || connectionStatus === 'connected') {
    return;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  connecting = true;
  connectionStatus = 'initializing';
  lastError = null;

  try {
    const { state, saveCreds } = await createAuthState();

    const newSocket = makeWASocket({
      auth: state,

      logger,

      browser: ['WhatsApp API', 'Chrome', '1.0.0'],

      printQRInTerminal: false,

      markOnlineOnConnect: false,

      syncFullHistory: false,
    });

    socket = newSocket;

    newSocket.ev.on('creds.update', () => {
      void saveCreds().catch((error) => {
        console.error('Credential persistence failed:', error);
        lastError = 'Credential persistence failed';
      });
    });

    newSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;

        try {
          qrImage = await QRCode.toDataURL(qr);
        } catch (error) {
          console.error('QR generation failed:', error);
        }
      }

      if (connection === 'connecting') {
        connectionStatus = 'connecting';
      }

      if (connection === 'open') {
        connectionStatus = 'connected';

        qrCode = null;
        qrImage = null;

        lastConnected = new Date().toISOString();

        lastError = null;

        console.log('WhatsApp connected successfully.');
      }

      if (connection === 'close') {
        socket = null;

        qrCode = null;
        qrImage = null;

        const statusCode = (
          lastDisconnect?.error as Boom | undefined
        )?.output?.statusCode;

        const loggedOut =
          statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          connectionStatus = 'logged_out';

          console.error(
            'WhatsApp logged out. Manual re-pairing is required.'
          );

          return;
        }

        connectionStatus = 'disconnected';

        lastError = lastDisconnect?.error?.message || 'Connection closed';

        console.error('WhatsApp connection closed:', lastError);

        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;

            void startWhatsApp().catch((error) => {
              console.error('Reconnection failed:', error);
            });
          }, 5000);
        }
      }
    });

    handleWhatsAppEvents(newSocket);

  } catch (error) {
    connectionStatus = 'disconnected';

    lastError =
      error instanceof Error ? error.message : 'Unknown connection error';

    console.error('WhatsApp initialization failed:', error);

    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;

        void startWhatsApp();
      }, 10000);
    }

  } finally {
    connecting = false;
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const currentSocket = socket;

  socket = null;

  if (currentSocket) {
    try {
      await currentSocket.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  await clearAuthState();

  qrCode = null;
  qrImage = null;

  connectionStatus = 'logged_out';

  console.log('WhatsApp session removed.');
}
