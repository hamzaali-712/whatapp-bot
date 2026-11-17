import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import type { AuthenticationState, WASocket } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { logger } from '../config/logger.js';

export type WhatsAppConnectionState =
  | 'starting'
  | 'connecting'
  | 'qr_required'
  | 'connected'
  | 'reconnecting'
  | 'logged_out'
  | 'stopped'
  | 'error';

export interface AuthProvider {
  createAuthState(): Promise<{ state: AuthenticationState; saveCreds(): Promise<void> }>;
  clearAuthState(): Promise<void>;
}

interface ConnectionManagerOptions {
  authProvider: AuthProvider;
  onSocketCreated(socket: WASocket): void;
}

interface DisconnectError {
  output?: { statusCode?: number };
}

const MAX_RECONNECT_ATTEMPTS = 8;
const QR_EXPIRY_MS = 120_000;

export class WhatsAppConnectionManager {
  private socket: WASocket | undefined;
  private startPromise: Promise<void> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private qrExpiryTimer: ReturnType<typeof setTimeout> | undefined;
  private qrDataUrl: string | undefined;
  private reconnectAttempts = 0;
  private stopped = false;
  private state: WhatsAppConnectionState = 'stopped';
  private lastConnected: string | undefined;
  private lastError: string | undefined;

  public constructor(private readonly options: ConnectionManagerOptions) {}

  public getSocket(): WASocket | undefined {
    return this.socket;
  }

  public getStatus(): Record<string, unknown> {
    return {
      state: this.state,
      connected: this.state === 'connected',
      lastConnected: this.lastConnected ?? null,
      lastError: this.lastError ?? null,
      qrAvailable: Boolean(this.qrDataUrl),
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  public getQrDataUrl(): string | undefined {
    return this.qrDataUrl;
  }

  public async start(): Promise<void> {
    if (this.socket || this.startPromise) return this.startPromise;

    this.stopped = false;
    this.startPromise = this.createSocket();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = undefined;
    }
  }

  public async stop(): Promise<void> {
    this.stopped = true;
    this.clearTimers();
    this.clearQr();
    const activeSocket = this.socket;
    this.socket = undefined;
    this.state = 'stopped';
    activeSocket?.end(new Error('Server shutting down'));
  }

  public async logout(): Promise<void> {
    this.stopped = true;
    this.clearTimers();
    this.clearQr();
    const activeSocket = this.socket;
    this.socket = undefined;
    this.state = 'logged_out';
    if (activeSocket) {
      await activeSocket.logout();
    }
    await this.options.authProvider.clearAuthState();
  }

  private async createSocket(): Promise<void> {
    this.state = this.reconnectAttempts > 0 ? 'reconnecting' : 'starting';
    this.lastError = undefined;

    try {
      const { state, saveCreds } = await this.options.authProvider.createAuthState();
      if (this.stopped) return;

      const socket = makeWASocket({
        auth: state,
        // Baileys can log QR-adjacent pairing data at info level. Keep its
        // internal logger silent; lifecycle events are logged separately.
        logger: logger.child({ component: 'baileys' }, { level: 'silent' }),
        browser: ['WhatsApp API', 'Chrome', '1.0.0'],
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });

      this.socket = socket;
      socket.ev.on('creds.update', () => {
        void saveCreds().catch((error: unknown) => {
          this.lastError = 'Authentication persistence failed';
          logger.error({ err: error }, 'WhatsApp authentication persistence failed');
        });
      });
      socket.ev.on('connection.update', (update) => {
        void this.handleConnectionUpdate(socket, update);
      });
      this.options.onSocketCreated(socket);
    } catch (error) {
      this.lastError = 'WhatsApp initialization failed';
      logger.error({ err: error }, 'WhatsApp initialization failed');
      this.scheduleReconnect();
    }
  }

  private async handleConnectionUpdate(
    socket: WASocket,
    update: { connection?: 'open' | 'connecting' | 'close'; qr?: string; lastDisconnect?: { error?: Error } },
  ): Promise<void> {
    if (this.socket !== socket || this.stopped) return;

    if (update.qr) {
      try {
        this.qrDataUrl = await QRCode.toDataURL(update.qr, { errorCorrectionLevel: 'M' });
        this.state = 'qr_required';
        this.resetQrExpiry();
      } catch (error) {
        this.lastError = 'QR generation failed';
        logger.error({ err: error }, 'WhatsApp QR generation failed');
      }
    }

    if (update.connection === 'connecting') {
      this.state = 'connecting';
      return;
    }

    if (update.connection === 'open') {
      this.state = 'connected';
      this.lastConnected = new Date().toISOString();
      this.lastError = undefined;
      this.reconnectAttempts = 0;
      this.clearQr();
      logger.info('WhatsApp connection opened');
      return;
    }

    if (update.connection === 'close') {
      this.socket = undefined;
      this.clearQr();
      const statusCode = (update.lastDisconnect?.error as DisconnectError | undefined)?.output?.statusCode;
      this.handleDisconnectReason(statusCode);
    }
  }

  private handleDisconnectReason(statusCode: number | undefined): void {
    if (this.stopped) return;

    if (statusCode === DisconnectReason.loggedOut) {
      this.state = 'logged_out';
      this.lastError = 'WhatsApp session logged out; pair again to continue.';
      logger.warn({ statusCode }, 'WhatsApp session logged out');
      return;
    }

    if (
      statusCode === DisconnectReason.badSession ||
      statusCode === DisconnectReason.forbidden ||
      statusCode === DisconnectReason.multideviceMismatch ||
      statusCode === DisconnectReason.connectionReplaced
    ) {
      this.state = 'error';
      this.lastError = 'WhatsApp session cannot be reconnected automatically.';
      logger.warn({ statusCode }, 'WhatsApp connection closed with terminal reason');
      return;
    }

    this.lastError = 'WhatsApp connection closed; reconnecting.';
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.state = 'error';
      this.lastError = 'WhatsApp reconnect attempts exhausted.';
      logger.error({ attempts: this.reconnectAttempts }, 'WhatsApp reconnect attempts exhausted');
      return;
    }

    this.reconnectAttempts += 1;
    this.state = 'reconnecting';
    const maximumDelay = Math.min(30_000, 1_000 * (2 ** (this.reconnectAttempts - 1)));
    const delay = Math.round(maximumDelay * (0.5 + Math.random() * 0.5));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.start();
    }, delay);
    logger.warn({ attempt: this.reconnectAttempts, delay }, 'WhatsApp reconnect scheduled');
  }

  private resetQrExpiry(): void {
    if (this.qrExpiryTimer) clearTimeout(this.qrExpiryTimer);
    this.qrExpiryTimer = setTimeout(() => this.clearQr(), QR_EXPIRY_MS);
  }

  private clearQr(): void {
    this.qrDataUrl = undefined;
    if (this.qrExpiryTimer) {
      clearTimeout(this.qrExpiryTimer);
      this.qrExpiryTimer = undefined;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
