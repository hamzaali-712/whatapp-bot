import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageStatusStore } from './message-status.js';

afterEach(() => vi.useRealTimers());

describe('outgoing receipt tracking', () => {
  it('distinguishes acceptance, server acknowledgement, delivery, and read', () => {
    const store = new MessageStatusStore();
    store.accept('outgoing');
    expect(store.get('outgoing')?.status).toBe('accepted');
    for (const [code, status] of [[2, 'server_ack'], [3, 'delivered'], [4, 'read']] as const) {
      store.update('outgoing', code);
      expect(store.get('outgoing')?.status).toBe(status);
    }
    store.update('outgoing', 2);
    expect(store.get('outgoing')?.status).toBe('read');
  });

  it('ignores unknown messages and invalid statuses and records errors', () => {
    const store = new MessageStatusStore();
    store.update('unknown', 3);
    expect(store.get('unknown')).toBeUndefined();
    store.accept('outgoing');
    store.update('outgoing', 9);
    expect(store.get('outgoing')?.status).toBe('accepted');
    store.update('outgoing', 0);
    expect(store.get('outgoing')?.status).toBe('error');
  });

  it('evicts old metadata at the size limit and after expiry', () => {
    vi.useFakeTimers();
    const store = new MessageStatusStore(1, 1_000);
    store.accept('first');
    store.accept('second');
    expect(store.get('first')).toBeUndefined();
    vi.advanceTimersByTime(1_000);
    expect(store.get('second')).toBeUndefined();
  });
});
