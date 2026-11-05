import { CODE_ALPHABET, CODE_LENGTH, allocateShareCode, generateShareCode, normalizeShareCode } from '../src/core/sharing/code';
import { buildShareDoc, can, detachOnEdit, planImport, planOwnerDeckDelete, planRefresh, publishUpdate, revokeShare, roleOf, unrevokeShare } from '../src/core/sharing/permissions';
import { Card, Deck } from '../src/core/models';
import { seeded } from './helpers';

const deck: Deck = { name: 'CPL', createdAtMs: 1, shareCode: null, importedFrom: null };
const card = (id: string, q: string, a = 'ans', over: Partial<Card> = {}): { id: string } & Card => ({ id, deckId: 'd1', question: q, answer: a, mastered: true, origin: null, ...over });
const cards = [card('c1', 'What is polymorphism?'), card('c2', 'What is a vtable?'), { ...card('x', 'other deck'), deckId: 'd2' }];
const OWNER = 'owner1'; const BOB = 'bob2';
const share = () => buildShareDoc('d1', deck, cards, OWNER, 'K7M2QX', 1000);

describe('share codes', () => {
  it('are 6 characters from the unambiguous alphabet', () => {
    const rng = seeded(7);
    for (let i = 0; i < 200; i++) {
      const c = generateShareCode(rng);
      expect(c).toHaveLength(CODE_LENGTH);
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
  it('normalise what people type and reject invalid codes', () => {
    expect(normalizeShareCode(' k7m-2qx ')).toBe('K7M2QX');
    expect(normalizeShareCode('K7M2Q')).toBeNull();
    expect(normalizeShareCode('K7M2Q0')).toBeNull();     // 0 is not in the alphabet
    expect(normalizeShareCode('K7M2QXX')).toBeNull();
  });
  it('allocation retries on collision and gives up after the limit', async () => {
    let calls = 0;
    const code = await allocateShareCode(async () => ++calls < 3, seeded(1));
    expect(calls).toBe(3); expect(code).toHaveLength(6);
    await expect(allocateShareCode(async () => true, seeded(1), 3)).rejects.toThrow();
  });
});

describe('permissions', () => {
  it('owner can publish/revoke/delete; recipients cannot', () => {
    const s = share();
    for (const a of ['publishUpdate', 'revoke', 'unrevoke', 'deleteShare'] as const) {
      expect(can(a, { uid: OWNER, share: s }).allowed).toBe(true);
      expect(can(a, { uid: BOB, share: s }).allowed).toBe(false);
    }
  });
  it('recipients can read and import; the owner cannot import their own deck', () => {
    const s = share();
    expect(can('read', { uid: BOB, share: s }).allowed).toBe(true);
    expect(can('import', { uid: BOB, share: s }).allowed).toBe(true);
    expect(can('import', { uid: OWNER, share: s }).allowed).toBe(false);
  });
  it('signed-out users have no access', () => {
    expect(roleOf(null, share())).toBeNull();
    expect(can('read', { uid: null, share: share() }).allowed).toBe(false);
  });
  it('revoking blocks recipients (read/import/refresh) but not the owner, and can be undone', () => {
    const s = revokeShare(share(), 2000);
    expect(can('read', { uid: BOB, share: s }).allowed).toBe(false);
    expect(can('import', { uid: BOB, share: s }).allowed).toBe(false);
    expect(can('read', { uid: OWNER, share: s }).allowed).toBe(true);
    expect(can('read', { uid: BOB, share: unrevokeShare(s, 3000) }).allowed).toBe(true);
  });
  it('refresh requires an imported deck that came from this code', () => {
    const s = share();
    const plan = planImport(s, BOB, 5000, seeded(3));
    expect(can('refresh', { uid: BOB, share: s, importedDeck: plan.deck }).allowed).toBe(true);
    expect(can('refresh', { uid: BOB, share: s, importedDeck: deck }).allowed).toBe(false);
    expect(can('refresh', { uid: BOB, share: s }).allowed).toBe(false);
  });
});

describe('import = independent snapshot copy', () => {
  it('snapshots only the deck\'s cards and imports with new ids, mastery reset and provenance', () => {
    const s = share();
    expect(s.cards.map(c => c.id)).toEqual(['c1', 'c2']);
    const plan = planImport(s, BOB, 5000, seeded(3));
    expect(plan.deck).toMatchObject({ name: 'CPL', shareCode: null, importedFrom: { code: 'K7M2QX', ownerUid: OWNER, version: 1 } });
    expect(plan.cards).toHaveLength(2);
    expect(plan.cards.every(c => !c.data.mastered && c.data.deckId === plan.deckId)).toBe(true);
    expect(plan.cards.map(c => c.data.origin?.sharedCardId)).toEqual(['c1', 'c2']);
    expect(new Set(plan.cards.map(c => c.id)).size).toBe(2);
  });
  it('refuses to import when revoked or when the importer is the owner', () => {
    expect(() => planImport(revokeShare(share(), 1), BOB, 1, seeded(1))).toThrow(/stopped sharing/);
    expect(() => planImport(share(), OWNER, 1, seeded(1))).toThrow(/already own/);
  });
});

describe('owner edits and refresh', () => {
  const setup = () => {
    const s1 = share();
    const imp = planImport(s1, BOB, 5000, seeded(3));
    const mine = imp.cards.map(c => ({ id: c.id, ...c.data }));
    return { s1, imp, mine };
  };

  it('owner edits do NOT reach recipients until they refresh (imports are snapshots)', () => {
    const { s1, imp } = setup();
    const edited = [card('c1', 'What is polymorphism? (edited)'), card('c2', 'What is a vtable?'), card('c3', 'New card')];
    const s2 = publishUpdate(s1, deck, edited, 6000);
    expect(s2.version).toBe(2);
    expect(imp.cards[0].data.question).toBe('What is polymorphism?');   // recipient copy unchanged
  });

  it('refresh adds new cards, updates edited ones, removes deleted ones', () => {
    const { s1, imp, mine } = setup();
    const s2 = publishUpdate(s1, deck, [card('c1', 'What is polymorphism? (edited)'), card('c3', 'New card')], 6000);
    const plan = planRefresh(s2, imp.deckId, imp.deck, mine, BOB, 7000, seeded(9));
    expect(plan.add.map(a => a.data.question)).toEqual(['New card']);
    expect(plan.update.map(u => u.question)).toEqual(['What is polymorphism? (edited)']);
    expect(plan.remove).toEqual([mine[1].id]);                    // c2 was removed by the owner
    expect(plan.upToDate).toBe(false);
  });

  it('refresh never touches the recipient\'s own cards or cards they edited (detached)', () => {
    const { s1, imp, mine } = setup();
    const edited = { ...mine[0], ...detachOnEdit({ ...mine[0], question: 'my wording' }) };
    const own = { id: 'own1', deckId: imp.deckId, question: 'mine', answer: 'x', mastered: false, origin: null };
    const s2 = publishUpdate(s1, deck, [card('c1', 'owner rewrote c1')], 6000);
    const plan = planRefresh(s2, imp.deckId, imp.deck, [edited, mine[1], own], BOB, 7000, seeded(9));
    expect(plan.update).toHaveLength(0);                          // c1 detached -> untouched
    expect(plan.remove).toEqual([mine[1].id]);                    // only the still-linked c2 is removed
    expect(plan.remove).not.toContain('own1');
  });

  it('is up to date when nothing changed', () => {
    const { s1, imp, mine } = setup();
    expect(planRefresh(s1, imp.deckId, imp.deck, mine, BOB, 7000, seeded(1)).upToDate).toBe(true);
  });

  it('revoked shares cannot be refreshed', () => {
    const { s1, imp, mine } = setup();
    expect(() => planRefresh(revokeShare(s1, 9), imp.deckId, imp.deck, mine, BOB, 7000, seeded(1))).toThrow(/stopped sharing/);
  });

  it('deleting the original deck never affects recipient copies; the share is kept unless revoke is chosen', () => {
    const s = share();
    const keep = planOwnerDeckDelete(s, { alsoRevoke: false }, 9000);
    expect(keep.share.revoked).toBe(false);
    expect(keep.recipientCopiesAffected).toBe(0);
    const revoke = planOwnerDeckDelete(s, { alsoRevoke: true }, 9000);
    expect(revoke.share.revoked).toBe(true);
    expect(revoke.recipientCopiesAffected).toBe(0);
  });
});
