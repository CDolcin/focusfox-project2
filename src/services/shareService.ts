import { Firestore, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ShareDoc } from '../core/sharing/permissions';
import { allocateShareCode, normalizeShareCode } from '../core/sharing/code';

/**
 * Shared-deck storage. The code is the capability: documents are fetched by exact id and cannot be listed
 * (enforced in firestore.rules). All decisions (who may do what) live in core/sharing/permissions.ts; the rules
 * repeat the owner-only write checks on the server as defence in depth.
 */
export interface ShareStore {
  get(code: string): Promise<ShareDoc | null>;
  exists(code: string): Promise<boolean>;
  put(share: ShareDoc): Promise<void>;
  delete(code: string): Promise<void>;
}

export class FirestoreShareStore implements ShareStore {
  constructor(private readonly db: Firestore) {}
  async get(code: string) { const s = await getDoc(doc(this.db, 'sharedDecks', code)); return s.exists() ? (s.data() as ShareDoc) : null; }
  async exists(code: string) { return (await getDoc(doc(this.db, 'sharedDecks', code))).exists(); }
  async put(share: ShareDoc) { await setDoc(doc(this.db, 'sharedDecks', share.code), share); }
  async delete(code: string) { await deleteDoc(doc(this.db, 'sharedDecks', code)); }
}

/** Offline/demo store: shares live in memory (same-device import only). Lets the whole flow be exercised without Firebase. */
export class MemoryShareStore implements ShareStore {
  private readonly m = new Map<string, ShareDoc>();
  async get(code: string) { const s = this.m.get(code); return s ? JSON.parse(JSON.stringify(s)) : null; }
  async exists(code: string) { return this.m.has(code); }
  async put(share: ShareDoc) { this.m.set(share.code, JSON.parse(JSON.stringify(share))); }
  async delete(code: string) { this.m.delete(code); }
}

export const newShareCode = (store: ShareStore) => allocateShareCode(c => store.exists(c));
export { normalizeShareCode };
