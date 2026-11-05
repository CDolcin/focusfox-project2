import { Card, Deck } from '../models';
import { Rng, createId } from '../ids';

/**
 * SHARED-DECK MODEL
 *
 *  - Owner publishes a SNAPSHOT of a deck to sharedDecks/{code} (title + cards + version). The code is the capability:
 *    knowing it is what lets a signed-in user read the snapshot. Nobody can list codes.
 *  - Roles: `owner` (created the share) and `recipient` (anyone else holding the code).
 *  - Recipients can READ and IMPORT. They can never edit the snapshot. Only the owner can publish updates
 *    (version + 1), revoke, un-revoke or delete the share.
 *  - IMPORT = independent copy in the recipient's own account (new ids, mastery reset). Imports are snapshots:
 *    later owner edits do not appear until the recipient taps Refresh.
 *  - REFRESH pulls the latest snapshot into the imported deck. It only touches cards that still carry `origin`
 *    (editing an imported card detaches it), so a recipient's own edits and own cards are never overwritten.
 *  - REVOKE stops new imports and refreshes. Existing copies are untouched.
 *  - OWNER DELETES THE ORIGINAL DECK: recipients' copies are never affected. The share itself is kept unless the
 *    owner explicitly chooses to revoke it as well.
 */
export interface SharedCard { id: string; question: string; answer: string }
export interface ShareDoc {
  code: string;
  ownerUid: string;
  deckId: string;
  title: string;
  version: number;
  revoked: boolean;
  cards: SharedCard[];
  createdAtMs: number;
  updatedAtMs: number;
}

export type Role = 'owner' | 'recipient';
export type ShareAction = 'read' | 'import' | 'refresh' | 'publishUpdate' | 'revoke' | 'unrevoke' | 'deleteShare';
export interface Decision { allowed: boolean; reason?: string }

export interface PermissionContext {
  uid: string | null;
  share: ShareDoc;
  /** For `refresh`: the recipient's imported deck. */
  importedDeck?: Deck;
}

export function roleOf(uid: string | null, share: ShareDoc): Role | null {
  if (!uid) return null;
  return uid === share.ownerUid ? 'owner' : 'recipient';
}

const no = (reason: string): Decision => ({ allowed: false, reason });
const yes: Decision = { allowed: true };

export function can(action: ShareAction, ctx: PermissionContext): Decision {
  const role = roleOf(ctx.uid, ctx.share);
  if (!role) return no('Sign in first');
  const { share } = ctx;
  switch (action) {
    case 'read':
      return role === 'owner' || !share.revoked ? yes : no('The owner has stopped sharing this deck');
    case 'import':
      if (role === 'owner') return no('You already own this deck');
      return share.revoked ? no('The owner has stopped sharing this deck') : yes;
    case 'refresh':
      if (role === 'owner') return no('You already own this deck');
      if (share.revoked) return no('The owner has stopped sharing this deck');
      if (!ctx.importedDeck?.importedFrom || ctx.importedDeck.importedFrom.code !== share.code) return no('This deck was not imported from this code');
      return yes;
    case 'publishUpdate':
    case 'revoke':
    case 'unrevoke':
    case 'deleteShare':
      return role === 'owner' ? yes : no('Only the owner can do this');
  }
}

// ------------------------------------------------------------------ owner side
export function buildShareDoc(deckId: string, deck: Deck, cards: Array<{ id: string } & Card>, ownerUid: string, code: string, nowMs: number): ShareDoc {
  return {
    code, ownerUid, deckId, title: deck.name, version: 1, revoked: false, createdAtMs: nowMs, updatedAtMs: nowMs,
    cards: cards.filter(c => c.deckId === deckId).map(c => ({ id: c.id, question: c.question, answer: c.answer })),
  };
}

/** Owner publishes the current state of the deck; version increases so recipients can see an update exists. */
export function publishUpdate(share: ShareDoc, deck: Deck, cards: Array<{ id: string } & Card>, nowMs: number): ShareDoc {
  return {
    ...share, title: deck.name, version: share.version + 1, updatedAtMs: nowMs,
    cards: cards.filter(c => c.deckId === share.deckId).map(c => ({ id: c.id, question: c.question, answer: c.answer })),
  };
}

export const revokeShare = (share: ShareDoc, nowMs: number): ShareDoc => ({ ...share, revoked: true, updatedAtMs: nowMs });
export const unrevokeShare = (share: ShareDoc, nowMs: number): ShareDoc => ({ ...share, revoked: false, updatedAtMs: nowMs });

/** What happens to the SHARE when the owner deletes the original deck. Recipient copies are never touched. */
export function planOwnerDeckDelete(share: ShareDoc, opts: { alsoRevoke: boolean }, nowMs: number): { share: ShareDoc; recipientCopiesAffected: 0 } {
  return { share: opts.alsoRevoke ? revokeShare(share, nowMs) : share, recipientCopiesAffected: 0 };
}

// ---------------------------------------------------------------- recipient side
export interface ImportPlan { deckId: string; deck: Deck; cards: Array<{ id: string; data: Card }> }

export function planImport(share: ShareDoc, recipientUid: string, nowMs: number, rng: Rng): ImportPlan {
  const d = can('import', { uid: recipientUid, share });
  if (!d.allowed) throw new Error(d.reason);
  const deckId = createId('deck', nowMs, rng);
  return {
    deckId,
    deck: { name: share.title, createdAtMs: nowMs, shareCode: null, importedFrom: { code: share.code, ownerUid: share.ownerUid, version: share.version } },
    cards: share.cards.map(c => ({
      id: createId('card', nowMs, rng),
      data: { deckId, question: c.question, answer: c.answer, mastered: false, origin: { sharedCardId: c.id } },
    })),
  };
}

export interface RefreshPlan {
  upToDate: boolean;
  add: Array<{ id: string; data: Card }>;
  update: Array<{ id: string; question: string; answer: string }>;
  remove: string[];
  newVersion: number;
}

/** Diff the latest snapshot against the imported deck. Cards without `origin` (recipient's own or detached) are never touched. */
export function planRefresh(share: ShareDoc, importedDeckId: string, importedDeck: Deck, currentCards: Array<{ id: string } & Card>, recipientUid: string, nowMs: number, rng: Rng): RefreshPlan {
  const d = can('refresh', { uid: recipientUid, share, importedDeck });
  if (!d.allowed) throw new Error(d.reason);
  const mine = currentCards.filter(c => c.deckId === importedDeckId && c.origin);
  const bySharedId = new Map(mine.map(c => [c.origin!.sharedCardId, c]));
  const snapshotIds = new Set(share.cards.map(c => c.id));
  const add: RefreshPlan['add'] = [];
  const update: RefreshPlan['update'] = [];
  for (const sc of share.cards) {
    const existing = bySharedId.get(sc.id);
    if (!existing) add.push({ id: createId('card', nowMs, rng), data: { deckId: importedDeckId, question: sc.question, answer: sc.answer, mastered: false, origin: { sharedCardId: sc.id } } });
    else if (existing.question !== sc.question || existing.answer !== sc.answer) update.push({ id: existing.id, question: sc.question, answer: sc.answer });
  }
  const remove = mine.filter(c => !snapshotIds.has(c.origin!.sharedCardId)).map(c => c.id);
  return {
    add, update, remove, newVersion: share.version,
    upToDate: !add.length && !update.length && !remove.length && importedDeck.importedFrom!.version === share.version,
  };
}

/** Call when a recipient edits an imported card: it becomes the recipient's own and Refresh will leave it alone. */
export function detachOnEdit(card: Card): Card { return { ...card, origin: null }; }
