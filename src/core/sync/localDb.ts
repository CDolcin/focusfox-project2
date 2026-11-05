import { CollectionName, SyncRecord } from '../models';
import { KeyValueStore } from './store';

export interface QueuedOp {
  seq: number;
  coll: CollectionName;
  id: string;
  record: SyncRecord<Record<string, unknown>>;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  /** Permanently failed (e.g. permission denied). Kept for inspection, never retried automatically. */
  dead?: boolean;
}

/**
 * Local persistence for one signed-in user. All keys are namespaced by `scope` (the uid), so switching accounts
 * on one phone never mixes data. No React and no Firebase in here: it can be tested with MemoryKV.
 */
export class LocalDb {
  constructor(private readonly kv: KeyValueStore, readonly scope: string) {}

  private k(...parts: Array<string | number>) { return `ff:${this.scope}:${parts.join(':')}`; }

  // ---- records ----
  async getRecord<T = Record<string, unknown>>(coll: CollectionName, id: string): Promise<SyncRecord<T> | undefined> {
    const raw = await this.kv.get(this.k('rec', coll, id));
    return raw ? (JSON.parse(raw) as SyncRecord<T>) : undefined;
  }
  async putRecord(coll: CollectionName, rec: SyncRecord<object>): Promise<void> {
    await this.kv.set(this.k('rec', coll, rec.id), JSON.stringify(rec));
  }
  async listRecords<T = Record<string, unknown>>(coll: CollectionName, includeDeleted = false): Promise<Array<SyncRecord<T>>> {
    const keys = await this.kv.keysWithPrefix(this.k('rec', coll, ''));
    const raws = this.kv.multiGet ? await this.kv.multiGet(keys) : await Promise.all(keys.map(k => this.kv.get(k)));
    const out: Array<SyncRecord<T>> = [];
    for (const raw of raws) {
      if (!raw) continue;
      const rec = JSON.parse(raw) as SyncRecord<T>;
      if (includeDeleted || !rec.deleted) out.push(rec);
    }
    return out;
  }

  // ---- meta (cursors, device id, last hlc) ----
  async getMeta(name: string): Promise<string | null> { return this.kv.get(this.k('meta', name)); }
  async setMeta(name: string, value: string): Promise<void> { await this.kv.set(this.k('meta', name), value); }

  // ---- queue ----
  async nextSeq(): Promise<number> {
    const cur = Number((await this.getMeta('seq')) ?? '0') + 1;
    await this.setMeta('seq', String(cur));
    return cur;
  }
  async putOp(op: QueuedOp): Promise<void> { await this.kv.set(this.k('q', String(op.seq).padStart(10, '0')), JSON.stringify(op)); }
  async removeOp(seq: number): Promise<void> { await this.kv.remove(this.k('q', String(seq).padStart(10, '0'))); }
  async listOps(): Promise<QueuedOp[]> {
    const keys = await this.kv.keysWithPrefix(this.k('q', ''));
    const raws = this.kv.multiGet ? await this.kv.multiGet(keys) : await Promise.all(keys.map(k => this.kv.get(k)));
    const out: QueuedOp[] = [];
    for (const raw of raws) if (raw) out.push(JSON.parse(raw) as QueuedOp);
    return out.sort((a, b) => a.seq - b.seq);
  }

  /** Remove everything for this user (sign out with "clear local data"). */
  async wipe(): Promise<void> {
    const keys = await this.kv.keysWithPrefix(`ff:${this.scope}:`);
    await Promise.all(keys.map(k => this.kv.remove(k)));
  }
}
