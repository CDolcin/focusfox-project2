import { CollectionName, SyncRecord } from '../models';
import { compareHlc } from './hlc';

export type RemoteErrorCode = 'offline' | 'unavailable' | 'permission' | 'invalid' | 'unknown';

export class RemoteError extends Error {
  constructor(readonly code: RemoteErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'RemoteError';
  }
  /** Network-type problems are retried with backoff; permission/validation problems are not. */
  get retryable(): boolean { return this.code === 'offline' || this.code === 'unavailable' || this.code === 'unknown'; }
}

export function asRemoteError(e: unknown): RemoteError {
  return e instanceof RemoteError ? e : new RemoteError('unknown', e instanceof Error ? e.message : String(e));
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export type AnyRecord = SyncRecord<Record<string, unknown>>;
export type PushResult = { status: 'applied' } | { status: 'stale'; current: AnyRecord };
export interface PullPage { records: AnyRecord[]; cursor: string | null; hasMore: boolean }
export type Unsubscribe = () => void;

/**
 * Transport contract. A push is a CONDITIONAL write: the server applies it only if the stored record has a
 * smaller hlc ("stale" otherwise). Pull is a cursor read ordered by a server-assigned sequence/timestamp, so
 * clients never miss a record even if device clocks disagree.
 */
export interface RemoteAdapter {
  push(coll: CollectionName, record: AnyRecord): Promise<PushResult>;
  pull(coll: CollectionName, cursor: string | null, limit: number): Promise<PullPage>;
  /** Real-time listener (Firestore onSnapshot). Optional: the engine also works with pull-only transports. */
  subscribe?(coll: CollectionName, cursor: string | null, onRecords: (records: AnyRecord[]) => void, onError?: (e: unknown) => void): Unsubscribe;
}

/**
 * In-memory server with the same semantics as the Firestore adapter (conditional LWW write + monotonic server
 * sequence used as the pull cursor). Used by the unit tests and as a stand-in when Firebase is not configured.
 */
export class InMemoryRemote implements RemoteAdapter {
  online = true;
  failNext: RemoteError | null = null;
  pushCount = 0;
  private seq = 0;
  private readonly store = new Map<CollectionName, Map<string, { rec: AnyRecord; seq: number }>>();
  private readonly listeners = new Map<CollectionName, Set<(r: AnyRecord[]) => void>>();
  /** Optional hook letting a test run code while a push is "in flight". */
  beforePushResolves?: () => Promise<void>;

  private coll(c: CollectionName) {
    if (!this.store.has(c)) this.store.set(c, new Map());
    return this.store.get(c)!;
  }
  private guard() {
    if (!this.online) throw new RemoteError('offline');
    if (this.failNext) { const e = this.failNext; this.failNext = null; throw e; }
  }

  async push(c: CollectionName, record: AnyRecord): Promise<PushResult> {
    this.guard();
    this.pushCount++;
    if (this.beforePushResolves) await this.beforePushResolves();
    const cur = this.coll(c).get(record.id);
    if (cur && compareHlc(cur.rec.hlc, record.hlc) >= 0) return { status: 'stale', current: cur.rec };
    this.seq += 1;
    this.coll(c).set(record.id, { rec: clone(record), seq: this.seq });
    this.listeners.get(c)?.forEach(l => l([clone(record)]));
    return { status: 'applied' };
  }

  async pull(c: CollectionName, cursor: string | null, limit: number): Promise<PullPage> {
    this.guard();
    const after = cursor ? Number(cursor) : 0;
    const rows = [...this.coll(c).values()].filter(r => r.seq > after).sort((a, b) => a.seq - b.seq);
    const page = rows.slice(0, limit);
    return {
      records: page.map(r => clone(r.rec)),
      cursor: page.length ? String(page[page.length - 1].seq) : cursor,
      hasMore: rows.length > limit,
    };
  }

  subscribe(c: CollectionName, _cursor: string | null, onRecords: (r: AnyRecord[]) => void): Unsubscribe {
    if (!this.listeners.has(c)) this.listeners.set(c, new Set());
    this.listeners.get(c)!.add(onRecords);
    return () => this.listeners.get(c)?.delete(onRecords);
  }

  /** Test helper: read the server copy. */
  peek(c: CollectionName, id: string): AnyRecord | undefined { return this.coll(c).get(id)?.rec; }
}
