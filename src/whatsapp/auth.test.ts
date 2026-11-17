import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proto } from '@whiskeysockets/baileys';

const database = vi.hoisted(() => ({ rows: new Map<string, string>(), failWrites: false }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      let operation = 'read';
      let key: string | undefined;
      let ids: string[] | undefined;
      let records: Array<{ key: string; value: string }> = [];
      let single = false;
      const query = {
        select: () => query,
        eq: (column: string, value: string) => { if (column === 'key') key = value; return query; },
        in: (_column: string, values: string[]) => { ids = values; return query; },
        limit: () => query,
        abortSignal: () => query,
        maybeSingle: () => { single = true; return query; },
        delete: () => { operation = 'delete'; return query; },
        upsert: (value: typeof records | typeof records[number]) => {
          operation = 'write'; records = Array.isArray(value) ? value : [value]; return query;
        },
        then: (resolve: (value: unknown) => unknown) => {
          if (operation !== 'read' && database.failWrites) return Promise.resolve({ error: { message: 'database unavailable' } }).then(resolve);
          if (operation === 'write') for (const row of records) database.rows.set(row.key, row.value);
          if (operation === 'delete') for (const id of ids ?? [...database.rows.keys()]) database.rows.delete(id);
          const data = [...database.rows].filter(([id]) => (!key || id === key) && (!ids || ids.includes(id)))
            .map(([id, value]) => ({ key: id, value }));
          return Promise.resolve({ data: single ? data[0] ?? null : data, error: null }).then(resolve);
        },
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  database.rows.clear();
  database.failWrites = false;
});

describe('Supabase authentication adapter (mocked database)', () => {
  it('encrypts credentials and restores the same identity', async () => {
    const { createAuthState } = await import('./auth.js');
    const first = await createAuthState();
    expect(database.rows.get('creds')).toMatch(/^v1\./);
    expect(database.rows.get('creds')).not.toContain('noiseKey');
    const restored = await createAuthState();
    expect(restored.state.creds.noiseKey).toEqual(first.state.creds.noiseKey);
  });

  it('restores protobuf app-state keys and deletes removed keys', async () => {
    const { createAuthState } = await import('./auth.js');
    const { state } = await createAuthState();
    await state.keys.set({ 'app-state-sync-key': { sample: { keyData: Buffer.from('secret') } } });
    const restored = await createAuthState();
    const keys = await restored.state.keys.get('app-state-sync-key', ['sample']);
    expect(keys.sample).toBeInstanceOf(proto.Message.AppStateSyncKeyData);
    expect(Buffer.from(keys.sample.keyData!)).toEqual(Buffer.from('secret'));
    await restored.state.keys.set({ 'app-state-sync-key': { sample: null } });
    expect(database.rows.has('app-state-sync-key:sample')).toBe(false);
    const afterDeletion = await createAuthState();
    expect(await afterDeletion.state.keys.get('app-state-sync-key', ['sample'])).toEqual({});
  });

  it('preserves write failures for shutdown and readiness', async () => {
    const { createAuthState, flushAuthWrites, isAuthStorageReady } = await import('./auth.js');
    const { saveCreds } = await createAuthState();
    database.failWrites = true;
    await expect(saveCreds()).rejects.toThrow('Auth write failed');
    await expect(flushAuthWrites()).rejects.toThrow('Authentication persistence failed');
    expect(await isAuthStorageReady()).toBe(false);
  });
});
