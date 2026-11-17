
import {
  BufferJSON,
  initAuthCreds,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';

import type { AuthenticationState } from '@whiskeysockets/baileys';
import type { SignalDataSet, SignalDataTypeMap, SignalKeyStore } from '@whiskeysockets/baileys';

import { createClient } from '@supabase/supabase-js';

import pino from 'pino';

import { env } from '../config/env.js';
import { decryptAuthValue, encryptAuthValue, encryptionKeyFromHex } from './crypto.js';

const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const sessionId = env.WHATSAPP_SESSION_ID;
const encryptionKey = encryptionKeyFromHex(env.AUTH_ENCRYPTION_KEY);
let pendingWrites: Promise<void> = Promise.resolve();

const logger = pino({ level: 'silent' });

// Convert Baileys objects into safely serializable JSON.
function encode(value: unknown): string {
  return JSON.stringify(value, BufferJSON.replacer);
}

// Restore Buffer objects from serialized JSON.
function decode<T>(value: string): T {
  return JSON.parse(value, BufferJSON.reviver) as T;
}

async function getStoredValue(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('whatsapp_auth')
    .select('value')
    .eq('session_id', sessionId)
    .eq('key', key)
    .maybeSingle();

  if (error) {
    throw new Error(`Auth read failed: ${error.message}`);
  }

  return data?.value ? decryptAuthValue(data.value, encryptionKey) : null;
}

async function saveStoredValue(
  key: string,
  value: string
): Promise<void> {
  const encryptedValue = encryptAuthValue(value, encryptionKey);
  const write = async () => {
  const { error } = await supabase
    .from('whatsapp_auth')
    .upsert(
      {
        session_id: sessionId,
        key,
        value: encryptedValue,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'session_id,key',
      }
    );

  if (error) {
    throw new Error(`Auth write failed: ${error.message}`);
  }
  };
  const operation = pendingWrites.then(write);
  pendingWrites = operation.catch(() => undefined);
  await operation;
}

// Load credentials or initialize a new WhatsApp session.
async function loadCredentials() {
  const stored = await getStoredValue('creds');

  if (stored) {
    return decode<AuthenticationState['creds']>(stored);
  }

  const credentials = initAuthCreds();

  await saveStoredValue('creds', encode(credentials));

  return credentials;
}

// Custom persistent Signal key store.
const signalKeyStore: SignalKeyStore = {
  async get<T extends keyof SignalDataTypeMap>(type: T, ids: string[]) {
    if (!ids.length) return {};

    const keys = ids.map((id) => `${type}:${id}`);

    const { data, error } = await supabase
      .from('whatsapp_auth')
      .select('key, value')
      .eq('session_id', sessionId)
      .in('key', keys);

    if (error) {
      throw new Error(`Signal key read failed: ${error.message}`);
    }

    const result: Record<string, SignalDataTypeMap[T]> = {};

    for (const row of data || []) {
      const originalId = row.key.slice(type.length + 1);

      result[originalId] = decode<SignalDataTypeMap[T]>(decryptAuthValue(row.value, encryptionKey));
    }

    return result;
  },

  async set(data: SignalDataSet) {
    const records: Array<{
      session_id: string;
      key: string;
      value: string;
      updated_at: string;
    }> = [];

    const deletions: string[] = [];

    for (const [type, entries] of Object.entries(data) as Array<[
      keyof SignalDataTypeMap,
      Record<string, SignalDataTypeMap[keyof SignalDataTypeMap] | null>,
    ]>) {
      for (const [id, value] of Object.entries(entries)) {
        const key = `${type}:${id}`;

        if (value === null || value === undefined) {
          deletions.push(key);
        } else {
          records.push({
            session_id: sessionId,
            key,
            value: encryptAuthValue(encode(value), encryptionKey),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (deletions.length) {
      const operation = pendingWrites.then(async () => {
      const { error } = await supabase
        .from('whatsapp_auth')
        .delete()
        .eq('session_id', sessionId)
        .in('key', deletions);

      if (error) {
        throw new Error(`Signal key deletion failed: ${error.message}`);
      }
      });
      pendingWrites = operation.catch(() => undefined);
      await operation;
    }

    if (records.length) {
      const operation = pendingWrites.then(async () => {
      const { error } = await supabase
        .from('whatsapp_auth')
        .upsert(records, {
          onConflict: 'session_id,key',
        });

      if (error) {
        throw new Error(`Signal key write failed: ${error.message}`);
      }
      });
      pendingWrites = operation.catch(() => undefined);
      await operation;
    }
  },
};

// Create a Baileys-compatible authentication state.
export async function createAuthState() {
  const creds = await loadCredentials();

  const keys = makeCacheableSignalKeyStore(
    signalKeyStore,
    logger
  );

  const state: AuthenticationState = {
    creds,
    keys,
  };

  async function saveCreds() {
    await saveStoredValue('creds', encode(state.creds));
  }

  return {
    state,
    saveCreds,
  };
}

// Remove the complete session from Supabase.
export async function clearAuthState() {
  await pendingWrites;
  const { error } = await supabase
    .from('whatsapp_auth')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Could not clear session: ${error.message}`);
  }
}

export async function flushAuthWrites(): Promise<void> {
  await pendingWrites;
}
