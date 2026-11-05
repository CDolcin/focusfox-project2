import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp, useCollection } from '../app/AppContext';
import { deleteDeck } from '../app/actions';
import { importByCode, importDeckFile, ownerDeleteDeck, publishDeck, refreshImported, setRevoked } from '../app/shareActions';
import { createId } from '../core/ids';
import { detachOnEdit } from '../core/sharing/permissions';
import { parseDeckFile } from '../core/export/html';
import { exportDeckFile, readTextFile } from '../services/exporter';
import { BackableHeader, Choice, DeleteX, Dialog, Empty, Fab, OutlinedField, OutlinedPill, Panel, PillBadge, PrimaryButton, Row, Screen, T, useColors } from '../ui/kit';

const fail = (e: unknown) => Alert.alert('Something went wrong', (e as Error)?.message ?? String(e));

/** Deck selection state shared by the study and manage screens (Project I selects a "module" by name). */
function useDecks() {
  const decks = useCollection('decks'); const cards = useCollection('cards');
  const sorted = useMemo(() => [...decks].sort((a, b) => a.createdAtMs - b.createdAtMs), [decks]);
  const [selected, setSelected] = useState<string | null>(null);
  const deck = sorted.find(d => d.id === selected) ?? sorted[0] ?? null;
  useEffect(() => { if (deck && deck.id !== selected) setSelected(deck.id); }, [deck, selected]);
  const inDeck = useMemo(() => cards.filter(x => x.deckId === deck?.id).sort((a, b) => (a.hlc < b.hlc ? -1 : 1)), [cards, deck]);
  return { decks: sorted, deck, select: setSelected, cards: inDeck };
}

function DeckChips({ decks, selectedId, onSelect, extra }: { decks: Array<{ id: string; name: string }>; selectedId?: string; onSelect: (id: string) => void; extra?: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
      {decks.map(d => <Choice key={d.id} label={d.name} selected={d.id === selectedId} onPress={() => onSelect(d.id)} size="sm" />)}
      {extra}
    </ScrollView>
  );
}

/** Project I FlashcardsScreen: pick a module, tap to reveal, Got it / Previous, mastery bar. */
export function FlashcardsScreen({ onBack, onManage }: { onBack: () => void; onManage: () => void }) {
  const { engine } = useApp(); const c = useColors();
  const { decks, deck, select, cards } = useDecks();
  const [i, setI] = useState(0); const [revealed, setRevealed] = useState(false);
  useEffect(() => { setI(0); setRevealed(false); }, [deck?.id]);
  const card = cards[i];
  const mastered = cards.filter(x => x.mastered).length; const pct = cards.length ? Math.floor(mastered * 100 / cards.length) : 0;
  const next = () => { setRevealed(false); setI(Math.min(cards.length - 1, i + 1)); };
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <BackableHeader title="Flashcards" subtitle="Revise actively, remember longer" onBack={onBack} style={{ flex: 1 }} />
        <OutlinedPill title="Manage" onPress={onManage} />
      </Row>
      <View style={{ height: 16 }} />
      <DeckChips decks={decks} selectedId={deck?.id} onSelect={select} />
      <View style={{ height: 20 }} />
      {!card ? <Empty text="No cards in this deck yet." /> : (
        <>
          <Pressable onPress={() => !revealed && setRevealed(true)} accessibilityRole="button" accessibilityLabel="Reveal answer">
            <Panel radius={20} style={{ height: 340, padding: 24 }}>
              <Text style={{ color: c.purple, fontWeight: '700', fontSize: 12 }}>{revealed ? 'ANSWER' : 'QUESTION'}</Text>
              <View style={{ height: 16 }} />
              <Text style={{ flex: 1, fontSize: revealed ? 18 : 24, fontWeight: '700', color: c.text }}>{revealed ? card.answer : card.question}</Text>
              {!revealed && <T kind="bodyDim">Tap to reveal answer</T>}
            </Panel>
          </Pressable>
          <T kind="bodyDim" style={{ alignSelf: 'center', marginVertical: 16 }}>{i + 1} / {cards.length}</T>
          <Row style={{ justifyContent: 'space-between' }}>
            <OutlinedPill title="← Previous" onPress={() => { setRevealed(false); setI(Math.max(0, i - 1)); }} />
            <PrimaryButton title={revealed ? 'Got it →' : 'Next →'} style={{ height: 44, paddingHorizontal: 24 }} onPress={async () => { if (revealed) { await engine?.patch('cards', card.id, { mastered: true }); next(); } else setRevealed(true); }} />
          </Row>
          <View style={{ height: 28 }} />
          <T kind="titleLarge">Mastery</T>
          <View style={{ height: 10 }} />
          <View style={{ height: 8, backgroundColor: c.purpleLight, borderRadius: 4, overflow: 'hidden' }}><View style={{ height: 8, width: `${pct}%`, backgroundColor: c.purple }} /></View>
          <T kind="bodyDim" style={{ marginTop: 6 }}>{pct}% · {mastered} mastered</T>
        </>
      )}
    </Screen>
  );
}

/** Project I FlashcardManagerScreen (modules, cards, mastery checkbox, edit/delete, FAB) + sharing, import and export. */
export function FlashcardManagerScreen({ onBack, onStudy }: { onBack: () => void; onStudy: () => void }) {
  const { engine, shares, user } = useApp(); const c = useColors();
  const { decks, deck, select, cards } = useDecks();
  const [edit, setEdit] = useState<{ id: string | null; q: string; a: string } | null>(null);
  const [newDeck, setNewDeck] = useState<string | null>(null);
  const [codeDialog, setCodeDialog] = useState<string | null>(null);
  if (!engine || !user) return null;
  const imported = !!deck?.importedFrom;

  const saveCard = async () => {
    if (!edit || !deck || !edit.q.trim() || !edit.a.trim()) return;
    if (edit.id) { const cur = cards.find(x => x.id === edit.id)!; await engine.patch('cards', edit.id, { ...detachOnEdit(cur), question: edit.q.trim(), answer: edit.a.trim() }); }
    else await engine.upsert('cards', createId('card'), { deckId: deck.id, question: edit.q.trim(), answer: edit.a.trim(), mastered: false, origin: null });
    setEdit(null);
  };
  const createDeck = async () => { const name = (newDeck ?? '').trim(); if (!name) return; const id = createId('deck'); await engine.upsert('decks', id, { name, createdAtMs: Date.now(), shareCode: null, importedFrom: null }); select(id); setNewDeck(null); };
  const share = async () => { if (!deck) return; try { setCodeDialog(await publishDeck(engine, shares, user.uid, deck.id)); } catch (e) { fail(e); } };
  const refresh = async () => { if (!deck) return; try { const r = await refreshImported(engine, shares, user.uid, deck.id); Alert.alert(r.changed ? 'Deck refreshed' : 'Already up to date', r.changed ? `${r.added} added, ${r.updated} updated, ${r.removed} removed. Cards you edited or added yourself were left alone.` : undefined); } catch (e) { fail(e); } };
  const remove = () => {
    if (!deck) return;
    if (deck.shareCode) Alert.alert('Delete module?', 'Copies other people imported are NOT affected. What should happen to the share code?', [
      { text: 'Cancel' },
      { text: 'Keep code active', onPress: () => void ownerDeleteDeck(engine, shares, user.uid, deck, false) },
      { text: 'Revoke code too', style: 'destructive', onPress: () => void ownerDeleteDeck(engine, shares, user.uid, deck, true) }]);
    else Alert.alert('Delete module?', `${cards.length} cards will be deleted.`, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteDeck(engine, deck.id) }]);
  };
  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <BackableHeader title="Manage Flashcards" subtitle="Add modules, cards, and track mastery" onBack={onBack} />
        <View style={{ height: 16 }} />
        <DeckChips decks={decks} selectedId={deck?.id} onSelect={select} extra={<PillBadge text="+ New module" bg={c.purpleLight} color={c.purple} onPress={() => setNewDeck('')} style={{ paddingHorizontal: 16, paddingVertical: 10 }} />} />
        {deck && (
          <>
            <View style={{ height: 14 }} />
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <OutlinedPill title="Study" onPress={onStudy} disabled={!cards.length} />
              {imported
                ? <OutlinedPill title="Refresh from owner" onPress={refresh} />
                : <OutlinedPill title={deck.shareCode ? 'Update shared copy' : 'Share'} onPress={share} />}
              {!imported && deck.shareCode ? <OutlinedPill title="Revoke code" onPress={async () => { try { await setRevoked(engine, shares, user.uid, deck, true); Alert.alert('Code revoked', 'No one can import or refresh with it. Existing copies are unchanged.'); } catch (e) { fail(e); } }} /> : null}
              <OutlinedPill title="Export file" onPress={() => exportDeckFile(deck, cards).catch(fail)} />
              <OutlinedPill title="Delete module" onPress={remove} />
            </Row>
            {imported ? <T kind="bodyDim" style={{ marginTop: 8 }}>Imported copy from code {deck.importedFrom!.code} (v{deck.importedFrom!.version}). Owner changes appear when you refresh.</T> : deck.shareCode ? <T kind="bodyDim" style={{ marginTop: 8 }}>Share code: {deck.shareCode}</T> : null}
          </>
        )}
        <View style={{ height: 16 }} />
        <T kind="bodyDim">{cards.length} card{cards.length === 1 ? '' : 's'} in {deck?.name ?? '—'}</T>
        <View style={{ height: 10 }} />
        {!deck ? <Empty text="No modules yet — tap + New module." /> : cards.length === 0 ? <Empty text="No cards in this module yet — tap + to add one." /> : (
          <View style={{ gap: 10, paddingBottom: 80 }}>
            {cards.map(card => (
              <Panel key={card.id}>
                <Row style={{ padding: 12 }}>
                  <Pressable onPress={() => engine.patch('cards', card.id, { mastered: !card.mastered })} accessibilityRole="checkbox" accessibilityState={{ checked: card.mastered }} accessibilityLabel="Mastered" hitSlop={8}
                    style={{ width: 22, height: 22, borderRadius: 4, borderWidth: card.mastered ? 0 : 2, borderColor: c.textSecondary, backgroundColor: card.mastered ? c.purple : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    {card.mastered ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ fontWeight: '600', fontSize: 16, color: c.text }}>{card.question}</Text>
                    <T kind="bodyDim" numberOfLines={2}>{card.answer}</T>
                    <T kind="labelDim">{card.mastered ? 'Mastered ✓' : 'Not mastered yet'}</T>
                  </View>
                  <Pressable onPress={() => setEdit({ id: card.id, q: card.question, a: card.answer })} accessibilityLabel="Edit" hitSlop={6} style={{ padding: 6 }}><MaterialIcons name="edit" size={22} color={c.purple} /></Pressable>
                  <DeleteX onPress={() => engine.remove('cards', card.id)} />
                </Row>
              </Panel>
            ))}
          </View>
        )}
        <OutlinedPill title="Import a shared deck…" onPress={() => { setNewDeck(null); setCodeDialog(''); }} style={{ marginTop: 8 }} />
        <OutlinedPill title="Import deck file…" style={{ marginTop: 8 }} onPress={async () => {
          try { const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true }); if (r.canceled) return; select(await importDeckFile(engine, parseDeckFile(await readTextFile(r.assets[0].uri)))); } catch (e) { fail(e); }
        }} />
      </Screen>
      <Fab onPress={() => deck ? setEdit({ id: null, q: '', a: '' }) : setNewDeck('')} label="Add card" />

      <Dialog visible={!!edit} title={`${edit?.id ? 'Edit flashcard' : 'New flashcard'} · ${deck?.name ?? ''}`} onDismiss={() => setEdit(null)} confirmLabel="Save" onConfirm={saveCard}>
        {edit && <>
          <OutlinedField placeholder="Question" value={edit.q} onChangeText={v => setEdit({ ...edit, q: v })} />
          <View style={{ height: 10 }} />
          <OutlinedField placeholder="Answer" multiline value={edit.a} onChangeText={v => setEdit({ ...edit, a: v })} inputStyle={{ minHeight: 100 }} />
        </>}
      </Dialog>
      <Dialog visible={newDeck !== null} title="New module" onDismiss={() => setNewDeck(null)} confirmLabel="Create" onConfirm={createDeck}>
        <OutlinedField placeholder="e.g. Data Structures" value={newDeck ?? ''} onChangeText={setNewDeck} />
      </Dialog>
      <ShareDialog code={codeDialog} deckName={deck?.name} onClose={() => setCodeDialog(null)} onImport={async (code) => { try { select(await importByCode(engine, shares, user.uid, code)); setCodeDialog(null); } catch (e) { fail(e); } }} />
    </View>
  );
}

/** codeDialog === '' -> "import by code" input; non-empty string -> "your deck's share code" confirmation. */
function ShareDialog({ code, deckName, onClose, onImport }: { code: string | null; deckName?: string; onClose: () => void; onImport: (code: string) => void }) {
  const [input, setInput] = useState('');
  const c = useColors();
  if (code === null) return null;
  if (code === '') return (
    <Dialog visible title="Import a shared deck" onDismiss={onClose} confirmLabel="Import" onConfirm={() => onImport(input)}>
      <T kind="bodyDim" style={{ marginBottom: 10 }}>Enter the 6-character code the owner gave you. You get your own copy; the owner can refresh or revoke it later.</T>
      <OutlinedField placeholder="e.g. K7M2QX" autoCapitalize="characters" maxLength={7} value={input} onChangeText={setInput} />
    </Dialog>
  );
  return (
    <Dialog visible title="Module shared" onDismiss={onClose} dismissLabel="OK" confirmLabel="Send code" onConfirm={() => { void Share.share({ message: `Import my FocusFox deck "${deckName}" with code ${code}` }); onClose(); }}>
      <Text style={{ fontSize: 34, fontWeight: '800', color: c.purple, letterSpacing: 4, textAlign: 'center' }}>{code}</Text>
      <T kind="bodyDim" style={{ marginTop: 10 }}>Anyone with this code can import a copy. After you edit the deck, tap "Update shared copy" to publish changes. Recipients can read and import only — they can't change your deck.</T>
    </Dialog>
  );
}
