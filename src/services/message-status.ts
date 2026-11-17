export type MessageStatus = 'accepted' | 'server_ack' | 'delivered' | 'read' | 'played' | 'error';
export interface MessageReceipt {
  messageId: string;
  status: MessageStatus;
  updatedAt: string;
}

// Volatile receipt metadata only: no recipient numbers or message contents.
export class MessageStatusStore {
  private readonly entries = new Map<string, { code: number; receipt: MessageReceipt; createdAt: number }>();

  public constructor(private readonly maxEntries = 1_000, private readonly ttlMs = 3_600_000) {}

  private prune(): void {
    for (const [id, entry] of this.entries) {
      if (Date.now() - entry.createdAt >= this.ttlMs) this.entries.delete(id);
    }
  }

  public accept(messageId: string): void {
    this.prune();
    if (this.entries.has(messageId)) return;
    while (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(messageId, { code: 1, createdAt: Date.now(), receipt: {
      messageId, status: 'accepted', updatedAt: new Date().toISOString(),
    } });
  }

  public update(messageId: string, code: number): void {
    this.prune();
    const entry = this.entries.get(messageId);
    if (!entry || !Number.isInteger(code) || code < 0 || code > 5) return;
    if (code !== 0 && (entry.code === 0 || code <= entry.code)) return;
    const statuses: MessageStatus[] = ['error', 'accepted', 'server_ack', 'delivered', 'read', 'played'];
    entry.code = code;
    entry.receipt = { messageId, status: statuses[code], updatedAt: new Date().toISOString() };
  }

  public get(messageId: string): MessageReceipt | undefined {
    this.prune();
    const entry = this.entries.get(messageId);
    return entry ? { ...entry.receipt } : undefined;
  }
}

export const messageStatuses = new MessageStatusStore();
