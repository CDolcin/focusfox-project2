import { CollectionName } from '../models';
import { Clock, systemClock } from './hlc';
import { LocalDb, QueuedOp } from './localDb';
import { AnyRecord } from './remote';

export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/** Deterministic exponential backoff (no jitter so it can be asserted in tests; add jitter in production if desired). */
export function backoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (attempts - 1));
}

/**
 * Persistent offline queue of pending writes.
 *  - Writes are appended while offline and survive an app restart (they live in LocalDb).
 *  - COALESCING: only the newest version of a record matters under LWW, so a second write to the same
 *    record replaces the queued one (keeps its place in line) instead of sending every intermediate edit.
 *  - Failed pushes back off exponentially; permanent failures are parked as `dead` and never retried automatically.
 */
export class OfflineQueue {
  constructor(private readonly db: LocalDb, private readonly clock: Clock = systemClock) {}

  async enqueue(coll: CollectionName, record: AnyRecord): Promise<QueuedOp> {
    const existing = (await this.db.listOps()).find(o => o.coll === coll && o.id === record.id && !o.dead);
    if (existing) {
      const merged: QueuedOp = { ...existing, record, attempts: 0, nextAttemptAt: 0, lastError: undefined };
      await this.db.putOp(merged);
      return merged;
    }
    const op: QueuedOp = { seq: await this.db.nextSeq(), coll, id: record.id, record, attempts: 0, nextAttemptAt: 0 };
    await this.db.putOp(op);
    return op;
  }

  /** Ops that may be attempted now, oldest first. */
  async ready(now: number = this.clock.now()): Promise<QueuedOp[]> {
    return (await this.db.listOps()).filter(o => !o.dead && o.nextAttemptAt <= now);
  }

  async pendingCount(): Promise<number> { return (await this.db.listOps()).filter(o => !o.dead).length; }
  async deadOps(): Promise<QueuedOp[]> { return (await this.db.listOps()).filter(o => o.dead); }
  async hasAnyOp(coll: CollectionName, id: string): Promise<boolean> {
    return (await this.db.listOps()).some(o => o.coll === coll && o.id === id);
  }

  /**
   * Acknowledge a push. If the record was edited again while the push was in flight (queued record now has a
   * different hlc) the newer content stays queued; only an acknowledged-identical op is removed.
   */
  async markSuccess(seq: number, pushedHlc: string): Promise<void> {
    const op = (await this.db.listOps()).find(o => o.seq === seq);
    if (!op) return;
    if (op.record.hlc === pushedHlc) await this.db.removeOp(seq);
    else await this.db.putOp({ ...op, attempts: 0, nextAttemptAt: 0, lastError: undefined });
  }

  async markFailure(seq: number, error: string, now: number = this.clock.now(), opts: { permanent?: boolean } = {}): Promise<void> {
    const op = (await this.db.listOps()).find(o => o.seq === seq);
    if (!op) return;
    const attempts = op.attempts + 1;
    await this.db.putOp({
      ...op, attempts, lastError: error,
      nextAttemptAt: now + backoffMs(attempts), dead: opts.permanent ? true : op.dead,
    });
  }

  /** Remove queued writes that a newer server version has already superseded. */
  async dropSuperseded(coll: CollectionName, id: string, winningHlc: string): Promise<void> {
    for (const op of await this.db.listOps()) {
      if (op.coll === coll && op.id === id && op.record.hlc <= winningHlc) await this.db.removeOp(op.seq);
    }
  }

  async retryDead(): Promise<number> {
    let n = 0;
    for (const op of await this.db.listOps()) {
      if (op.dead) { await this.db.putOp({ ...op, dead: false, attempts: 0, nextAttemptAt: 0 }); n++; }
    }
    return n;
  }
}
