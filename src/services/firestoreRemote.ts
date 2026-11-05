import {
  Firestore, Timestamp, collection, doc, getDocs, limit as qLimit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, startAfter, where,
} from 'firebase/firestore';
import { CollectionName } from '../core/models';
import { AnyRecord, PullPage, PushResult, RemoteAdapter, RemoteError, Unsubscribe, compareHlc } from '../core/sync';

/** Pull cursors are rewound by this much so a write that committed late (smaller server time) is never skipped. Ingest is idempotent. */
export const CURSOR_OVERLAP_MS = 5000;

function toRemoteError(e: unknown): RemoteError {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied') || code.includes('unauthenticated')) return new RemoteError('permission', code);
  if (code.includes('invalid-argument') || code.includes('failed-precondition')) return new RemoteError('invalid', code);
  if (code.includes('unavailable') || code.includes('deadline') || code.includes('network')) return new RemoteError('unavailable', code);
  return new RemoteError('unknown', (e as Error)?.message ?? String(e));
}

/**
 * Firestore transport. Layout: users/{uid}/{collection}/{id}.
 * Push is a transaction that compares hlc strings (the same deterministic order the clients use) and writes only if newer.
 * `serverUpdatedAt` is assigned by the server and is used ONLY as the pull cursor.
 */
export class FirestoreRemote implements RemoteAdapter {
  constructor(private readonly db: Firestore, private readonly uid: string) {}
  private col(c: CollectionName) { return collection(this.db, 'users', this.uid, c); }

  async push(c: CollectionName, record: AnyRecord): Promise<PushResult> {
    const ref = doc(this.col(c), record.id);
    try {
      return await runTransaction(this.db, async tx => {
        const snap = await tx.get(ref);
        if (snap.exists()) {
          const cur = snap.data() as AnyRecord;
          if (compareHlc(cur.hlc, record.hlc) >= 0) return { status: 'stale', current: { ...cur, id: snap.id } } as PushResult;
        }
        tx.set(ref, { ...record, serverUpdatedAt: serverTimestamp() });
        return { status: 'applied' } as PushResult;
      });
    } catch (e) { throw toRemoteError(e); }
  }

  private strip(d: Record<string, unknown>, id: string): AnyRecord {
    const { serverUpdatedAt: _s, ...rest } = d as Record<string, unknown>;
    return { ...(rest as object), id } as AnyRecord;
  }

  /**
   * Cursor format: "<serverMs>" (rewound by the overlap, used between syncs) or "<serverMs>|<docId>" (exact position,
   * used between pages of one sync so a page full of same-instant writes can never loop or be skipped).
   */
  async pull(c: CollectionName, cursor: string | null, pageSize: number): Promise<PullPage> {
    try {
      const [msPart, idPart] = (cursor ?? '0').split('|');
      const ms = Number(msPart) || 0;
      const base = [orderBy('serverUpdatedAt'), orderBy('__name__')] as const;
      const q = idPart
        ? query(this.col(c), ...base, startAfter(Timestamp.fromMillis(ms), idPart), qLimit(pageSize + 1))
        : query(this.col(c), where('serverUpdatedAt', '>', Timestamp.fromMillis(Math.max(0, ms))), ...base, qLimit(pageSize + 1));
      const snap = await getDocs(q);
      const docs = snap.docs.slice(0, pageSize);
      const hasMore = snap.docs.length > pageSize;
      const lastDoc = docs[docs.length - 1];
      const lastTs = lastDoc ? (lastDoc.data().serverUpdatedAt as Timestamp | null)?.toMillis() : undefined;
      let next = cursor;
      if (lastDoc && lastTs !== undefined) next = hasMore ? `${lastTs}|${lastDoc.id}` : String(Math.max(0, lastTs - CURSOR_OVERLAP_MS));
      return { records: docs.map(d => this.strip(d.data(), d.id)), cursor: next, hasMore };
    } catch (e) { throw toRemoteError(e); }
  }

  subscribe(c: CollectionName, cursor: string | null, onRecords: (r: AnyRecord[]) => void, onError?: (e: unknown) => void): Unsubscribe {
    const after = Timestamp.fromMillis(Math.max(0, Number((cursor ?? '0').split('|')[0])));
    const q = query(this.col(c), where('serverUpdatedAt', '>', after), orderBy('serverUpdatedAt'));
    return onSnapshot(q, snap => {
      const recs = snap.docChanges().filter(ch => ch.type !== 'removed').map(ch => this.strip(ch.doc.data(), ch.doc.id));
      if (recs.length) onRecords(recs);
    }, e => onError?.(toRemoteError(e)));
  }
}
