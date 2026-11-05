import { CollectionName, COLLECTIONS, DataTypes, SyncRecord } from '../models';
import { Clock, HybridClock, systemClock } from './hlc';
import { LocalDb } from './localDb';
import { OfflineQueue } from './queue';
import { AnyRecord, RemoteAdapter, asRemoteError, Unsubscribe } from './remote';
import { resolve } from './reconcile';

export interface EngineOptions {
  db: LocalDb;
  remote: RemoteAdapter | null;   // null = local-only mode (Firebase not configured / signed out)
  deviceId: string;
  clock?: Clock;
  pageSize?: number;
}
export interface FlushResult { pushed: number; stale: number; failed: number; stoppedOffline: boolean }
export interface PullResult { pulled: number; applied: number }
export interface SyncSummary extends FlushResult { pulled: number; applied: number }

/**
 * Local-first sync engine. UI code only ever talks to the local database through this class:
 *   write  -> stamp with HLC -> save locally -> enqueue (instant, works offline)
 *   sync   -> flush queue (conditional pushes) -> pull remote changes since cursor -> reconcile (LWW)
 * No React, no Firebase imports: remote is an injected adapter, so it is fully unit-testable.
 */
export class SyncEngine {
  private readonly db: LocalDb;
  private readonly remote: RemoteAdapter | null;
  private readonly clock: Clock;
  private readonly hlc: HybridClock;
  private readonly queue: OfflineQueue;
  private readonly pageSize: number;
  private readonly listeners = new Map<CollectionName, Set<() => void>>();
  private readonly subs: Unsubscribe[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  readonly deviceId: string;

  private constructor(o: EngineOptions, lastHlc: string | undefined) {
    this.db = o.db;
    this.remote = o.remote;
    this.clock = o.clock ?? systemClock;
    this.deviceId = o.deviceId;
    this.hlc = new HybridClock(o.deviceId, this.clock, lastHlc);
    this.queue = new OfflineQueue(o.db, this.clock);
    this.pageSize = o.pageSize ?? 200;
  }

  static async create(o: EngineOptions): Promise<SyncEngine> {
    const last = await o.db.getMeta('hlc');
    return new SyncEngine(o, last ?? undefined);
  }

  /** Serialise all state-changing work so read-modify-write cycles never interleave. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }
  private async stamp(): Promise<string> {
    const s = this.hlc.next();
    await this.db.setMeta('hlc', s);
    return s;
  }

  // ------------------------------------------------------------------ reads
  async get<C extends CollectionName>(coll: C, id: string): Promise<SyncRecord<DataTypes[C]> | undefined> {
    const rec = await this.db.getRecord<DataTypes[C]>(coll, id);
    return rec && !rec.deleted ? rec : undefined;
  }
  async list<C extends CollectionName>(coll: C): Promise<Array<SyncRecord<DataTypes[C]>>> {
    return this.db.listRecords<DataTypes[C]>(coll);
  }
  pendingCount(): Promise<number> { return this.queue.pendingCount(); }
  deadOps() { return this.queue.deadOps(); }
  retryDead() { return this.queue.retryDead(); }

  // ----------------------------------------------------------------- writes
  /** Create or fully replace a record's data. */
  upsert<C extends CollectionName>(coll: C, id: string, data: DataTypes[C]): Promise<SyncRecord<DataTypes[C]>> {
    return this.serial(async () => {
      const rec = { ...(data as object), id, hlc: await this.stamp(), deleted: false, updatedBy: this.deviceId } as SyncRecord<DataTypes[C]>;
      await this.db.putRecord(coll, rec);
      await this.queue.enqueue(coll, rec as unknown as AnyRecord);
      this.emit(coll);
      return rec;
    });
  }

  /** Merge a partial update into an existing record. Throws if the record does not exist (or is deleted). */
  patch<C extends CollectionName>(coll: C, id: string, partial: Partial<DataTypes[C]>): Promise<SyncRecord<DataTypes[C]>> {
    return this.serial(async () => {
      const cur = await this.db.getRecord<DataTypes[C]>(coll, id);
      if (!cur || cur.deleted) throw new Error(`${coll}/${id} not found`);
      const rec = { ...cur, ...partial, id, hlc: await this.stamp(), deleted: false, updatedBy: this.deviceId } as SyncRecord<DataTypes[C]>;
      await this.db.putRecord(coll, rec);
      await this.queue.enqueue(coll, rec as unknown as AnyRecord);
      this.emit(coll);
      return rec;
    });
  }

  /** Delete = write a tombstone (the record is kept, flagged deleted, so the deletion syncs and wins over older edits). */
  remove(coll: CollectionName, id: string): Promise<void> {
    return this.serial(async () => {
      const cur = await this.db.getRecord(coll, id);
      if (!cur || cur.deleted) return;
      const rec = { ...cur, hlc: await this.stamp(), deleted: true, updatedBy: this.deviceId };
      await this.db.putRecord(coll, rec);
      await this.queue.enqueue(coll, rec as unknown as AnyRecord);
      this.emit(coll);
    });
  }

  // ------------------------------------------------------------ remote -> local
  /** Apply records received from the server (pull page or real-time listener). Idempotent. */
  ingest(coll: CollectionName, records: AnyRecord[]): Promise<number> {
    return this.serial(async () => {
      let applied = 0;
      for (const remote of records) {
        this.hlc.observe(remote.hlc);
        const local = await this.db.getRecord(coll, remote.id);
        const winner = resolve(local, remote);
        if (winner === 'remote') {
          await this.db.putRecord(coll, remote);
          await this.queue.dropSuperseded(coll, remote.id, remote.hlc);
          applied++;
        } else if (winner === 'local' && local && !(await this.queue.hasAnyOp(coll, remote.id))) {
          // Anti-entropy: our version is newer than the server's but nothing is queued to deliver it (e.g. lost op).
          await this.queue.enqueue(coll, local as unknown as AnyRecord);
        }
      }
      if (records.length) await this.db.setMeta('hlc', this.hlc.last());
      if (applied) this.emit(coll);
      return applied;
    });
  }

  // ------------------------------------------------------------------- sync
  async flush(now: number = this.clock.now()): Promise<FlushResult> {
    const res: FlushResult = { pushed: 0, stale: 0, failed: 0, stoppedOffline: false };
    if (!this.remote) return res;
    const ops = await this.serial(() => this.queue.ready(now));
    for (const op of ops) {
      let outcome;
      try {
        outcome = await this.remote.push(op.coll, op.record);
      } catch (e) {
        const err = asRemoteError(e);
        await this.serial(() => this.queue.markFailure(op.seq, err.message, now, { permanent: !err.retryable }));
        res.failed++;
        if (err.code === 'offline' || err.code === 'unavailable') { res.stoppedOffline = true; break; }
        continue;
      }
      if (outcome.status === 'applied') {
        await this.serial(() => this.queue.markSuccess(op.seq, op.record.hlc));
        res.pushed++;
      } else {
        // Server already holds a newer (or identical) version: take it, drop our superseded op.
        await this.ingest(op.coll, [outcome.current]);
        await this.serial(() => this.queue.markSuccess(op.seq, op.record.hlc));
        res.stale++;
      }
    }
    return res;
  }

  async pull(coll?: CollectionName): Promise<PullResult> {
    const out: PullResult = { pulled: 0, applied: 0 };
    if (!this.remote) return out;
    for (const c of coll ? [coll] : COLLECTIONS) {
      let cursor = await this.db.getMeta(`cursor:${c}`);
      for (;;) {
        const page = await this.remote.pull(c, cursor, this.pageSize);
        out.pulled += page.records.length;
        out.applied += await this.ingest(c, page.records);
        if (page.cursor && page.cursor !== cursor) {
          cursor = page.cursor;
          await this.db.setMeta(`cursor:${c}`, cursor);
        }
        if (!page.hasMore) break;
      }
    }
    return out;
  }

  /** Full cycle: push local changes, pull remote changes, push anything the pull healed. */
  async sync(now: number = this.clock.now()): Promise<SyncSummary> {
    const f1 = await this.flush(now);
    if (f1.stoppedOffline) return { ...f1, pulled: 0, applied: 0 };
    const p = await this.pull();
    const f2 = await this.flush(now);
    return {
      pushed: f1.pushed + f2.pushed, stale: f1.stale + f2.stale, failed: f1.failed + f2.failed,
      stoppedOffline: f2.stoppedOffline, pulled: p.pulled, applied: p.applied,
    };
  }

  /** Start Firestore-style real-time listeners. Each snapshot is reconciled like a pull page. */
  async startRealtime(onError?: (e: unknown) => void): Promise<void> {
    this.stopRealtime();
    if (!this.remote?.subscribe) return;
    for (const c of COLLECTIONS) {
      const cursor = await this.db.getMeta(`cursor:${c}`);
      this.subs.push(this.remote.subscribe(c, cursor, recs => { void this.ingest(c, recs); }, onError));
    }
  }
  stopRealtime(): void { while (this.subs.length) this.subs.pop()!(); }

  // ----------------------------------------------------------------- events
  onChange(coll: CollectionName, fn: () => void): () => void {
    if (!this.listeners.has(coll)) this.listeners.set(coll, new Set());
    this.listeners.get(coll)!.add(fn);
    return () => this.listeners.get(coll)?.delete(fn);
  }
  private emit(coll: CollectionName) { this.listeners.get(coll)?.forEach(fn => fn()); }
}
