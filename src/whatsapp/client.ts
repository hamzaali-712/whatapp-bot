import { createAuthState, clearAuthState, flushAuthWrites } from './auth.js';
import { WhatsAppConnectionManager } from './connection.js';
import { handleWhatsAppEvents } from './events.js';

const manager = new WhatsAppConnectionManager({
  authProvider: { createAuthState, clearAuthState },
  onSocketCreated: handleWhatsAppEvents,
});

export function getSocket() {
  return manager.getSocket();
}

export function getWhatsAppStatus() {
  return manager.getStatus();
}

export function getQRCode() {
  return manager.getQrDataUrl();
}

export function startWhatsApp(): Promise<void> {
  return manager.start();
}

export async function stopWhatsApp(): Promise<void> {
  await manager.stop();
  await flushAuthWrites();
}

export function disconnectWhatsApp(): Promise<void> {
  return manager.logout();
}
