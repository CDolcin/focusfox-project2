import { Card, Deck, SyncRecord } from '../core/models';
import { SyncEngine } from '../core/sync';
import { ShareStore, newShareCode, normalizeShareCode } from '../services/shareService';
import { buildShareDoc, can, planImport, planOwnerDeckDelete, planRefresh, publishUpdate, revokeShare, unrevokeShare } from '../core/sharing/permissions';
import { createId } from '../core/ids';
import { deleteDeck } from './actions';

/** Orchestration only: every rule (who may do what, what an import/refresh changes) lives in core/sharing. */
const cardsOf = async (engine: SyncEngine, deckId: string) => (await engine.list('cards')).filter(c => c.deckId === deckId);

export async function publishDeck(engine: SyncEngine, store: ShareStore, uid: string, deckId: string): Promise<string> {
  const deck = await engine.get('decks', deckId); if (!deck) throw new Error('Deck not found');
  const cards = await cardsOf(engine, deckId);
  if (deck.shareCode) {                                                   // already shared -> publish a new version
    const cur = await store.get(deck.shareCode);
    if (cur) {
      if (!can('publishUpdate', { uid, share: cur }).allowed) throw new Error('Only the owner can update a shared deck.');
      await store.put(publishUpdate(cur, deck, cards, Date.now()));
      return deck.shareCode;
    }
  }
  const code = await newShareCode(store);
  await store.put(buildShareDoc(deckId, deck, cards, uid, code, Date.now()));
  await engine.patch('decks', deckId, { shareCode: code });
  return code;
}

export async function setRevoked(engine: SyncEngine, store: ShareStore, uid: string, deck: SyncRecord<Deck>, revoked: boolean) {
  const share = deck.shareCode ? await store.get(deck.shareCode) : null;
  if (!share) throw new Error('This deck is not shared.');
  const action = revoked ? 'revoke' : 'unrevoke';
  const d = can(action, { uid, share }); if (!d.allowed) throw new Error(d.reason);
  await store.put(revoked ? revokeShare(share, Date.now()) : unrevokeShare(share, Date.now()));
}

export async function importByCode(engine: SyncEngine, store: ShareStore, uid: string, raw: string): Promise<string> {
  const code = normalizeShareCode(raw); if (!code) throw new Error('Codes have 6 letters/numbers.');
  const share = await store.get(code);
  if (!share) throw new Error('No deck found for that code.');
  const plan = planImport(share, uid, Date.now(), Math.random);
  await engine.upsert('decks', plan.deckId, plan.deck);
  for (const c of plan.cards) await engine.upsert('cards', c.id, c.data);
  return plan.deckId;
}

export async function refreshImported(engine: SyncEngine, store: ShareStore, uid: string, deckId: string): Promise<{ changed: boolean; added: number; updated: number; removed: number }> {
  const deck = await engine.get('decks', deckId); if (!deck?.importedFrom) throw new Error('This deck was not imported.');
  const share = await store.get(deck.importedFrom.code); if (!share) throw new Error('The owner has deleted this share.');
  const plan = planRefresh(share, deckId, deck, await cardsOf(engine, deckId), uid, Date.now(), Math.random);
  if (plan.upToDate) return { changed: false, added: 0, updated: 0, removed: 0 };
  for (const a of plan.add) await engine.upsert('cards', a.id, a.data);
  for (const u of plan.update) await engine.patch('cards', u.id, { question: u.question, answer: u.answer });
  for (const id of plan.remove) await engine.remove('cards', id);
  await engine.patch('decks', deckId, { importedFrom: { ...deck.importedFrom, version: plan.newVersion } });
  return { changed: true, added: plan.add.length, updated: plan.update.length, removed: plan.remove.length };
}

/** Owner deletes the original deck. Recipient copies are never touched; the share is only revoked if the owner chooses. */
export async function ownerDeleteDeck(engine: SyncEngine, store: ShareStore, uid: string, deck: SyncRecord<Deck>, alsoRevoke: boolean) {
  if (deck.shareCode && alsoRevoke) {
    const share = await store.get(deck.shareCode);
    if (share && can('revoke', { uid, share }).allowed) await store.put(planOwnerDeckDelete(share, { alsoRevoke: true }, Date.now()).share);
  }
  await deleteDeck(engine, deck.id);
}

export async function importDeckFile(engine: SyncEngine, parsed: { name: string; cards: Array<Pick<Card, 'question' | 'answer'>> }): Promise<string> {
  const deckId = createId('deck');
  await engine.upsert('decks', deckId, { name: parsed.name, createdAtMs: Date.now(), shareCode: null, importedFrom: null });
  for (const c of parsed.cards) await engine.upsert('cards', createId('card'), { deckId, question: c.question, answer: c.answer, mastered: false, origin: null });
  return deckId;
}
