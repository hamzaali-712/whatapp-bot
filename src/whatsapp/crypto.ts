import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

export function encryptionKeyFromHex(value: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('AUTH_ENCRYPTION_KEY must be 32 bytes encoded as hex.');
  return Buffer.from(value, 'hex');
}

export function encryptAuthValue(plainText: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptAuthValue(envelope: string, key: Buffer): string {
  const [version, ivText, tagText, ciphertextText, ...extra] = envelope.split('.');
  if (version !== VERSION || !ivText || !tagText || !ciphertextText || extra.length > 0) throw new Error('Invalid encrypted auth record format.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Auth record decryption failed. Re-pairing is required if the encryption key was lost.');
  }
}
