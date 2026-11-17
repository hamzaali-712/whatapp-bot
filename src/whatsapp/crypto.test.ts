import { describe, expect, it } from 'vitest';
import { decryptAuthValue, encryptAuthValue, encryptionKeyFromHex } from './crypto.js';

const key = encryptionKeyFromHex('a'.repeat(64));

describe('encrypted auth values', () => {
  it('round trips encrypted values without retaining plaintext', () => {
    const plaintext = JSON.stringify({ secret: 'credential-value' });
    const encrypted = encryptAuthValue(plaintext, key);
    expect(encrypted).not.toContain('credential-value');
    expect(decryptAuthValue(encrypted, key)).toBe(plaintext);
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptAuthValue('sensitive', key);
    const parts = encrypted.split('.');
    parts[3] = `${parts[3].startsWith('A') ? 'B' : 'A'}${parts[3].slice(1)}`;
    expect(() => decryptAuthValue(parts.join('.'), key)).toThrow('decryption failed');
  });
});
