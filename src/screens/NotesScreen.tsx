import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp, useCollection } from '../app/AppContext';
import { Note } from '../core/models';
import { createId } from '../core/ids';
import { BackableHeader, DeleteX, Dialog, Empty, Fab, OutlinedField, Row, Screen, T, useColors } from '../ui/kit';
import { noteAccentColors } from '../ui/theme';

export default function NotesScreen({ onBack }: { onBack: () => void }) {
  const { engine } = useApp(); const c = useColors();
  const notes = useCollection('notes');
  const [q, setQ] = useState('');
  const [ed, setEd] = useState<{ id: string | null; title: string; content: string; colorTag: number; createdAtMs: number } | null>(null);
  const shown = notes.filter(n => (n.title + ' ' + n.content).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.createdAtMs - a.createdAtMs);
  const save = async () => {
    if (!engine || !ed) return;
    if (!ed.title.trim() && !ed.content.trim()) { setEd(null); return; }
    const data: Note = { title: ed.title.trim() || 'Untitled', content: ed.content, colorTag: ed.colorTag, createdAtMs: ed.createdAtMs };
    await engine.upsert('notes', ed.id ?? createId('note'), data); setEd(null);
  };
  return (
    <View style={{ flex: 1 }}>
      <Screen scroll={false}>
        <BackableHeader title="Quick Notes" subtitle="Capture ideas before they disappear" onBack={onBack} />
        <View style={{ height: 16 }} />
        <View>
          <OutlinedField placeholder="Search notes..." value={q} onChangeText={setQ} inputStyle={{ paddingLeft: 48 }} />
          <MaterialIcons name="search" size={24} color={c.textSecondary} style={{ position: 'absolute', left: 14, top: 14 }} />
        </View>
        <View style={{ height: 16 }} />
        {notes.length === 0 ? <Empty text="No notes yet — tap + to add your first one." /> : (
          <>
            <T kind="bodyDim">Tap a note to edit it</T>
            <View style={{ height: 8 }} />
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 90 }}>
              {shown.map(n => (
                <Pressable key={n.id} onPress={() => setEd({ id: n.id, title: n.title, content: n.content, colorTag: n.colorTag, createdAtMs: n.createdAtMs })} accessibilityRole="button">
                  <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', minHeight: 72 }}>
                    <View style={{ width: 4, backgroundColor: noteAccentColors[n.colorTag % noteAccentColors.length] }} />
                    <Row style={{ flex: 1, padding: 16, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 16, color: c.text }}>{n.title}</Text>
                        {n.content.trim() ? <T kind="bodyDim" numberOfLines={2}>{n.content}</T> : null}
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                        <T kind="bodyDim">{new Date(n.createdAtMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</T>
                        <DeleteX label="Delete note" onPress={() => Alert.alert('Delete note?', n.title, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => engine?.remove('notes', n.id) }])} />
                      </View>
                    </Row>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </Screen>
      <Fab onPress={() => setEd({ id: null, title: '', content: '', colorTag: Math.floor(Math.random() * noteAccentColors.length), createdAtMs: Date.now() })} label="Add note" />
      <Dialog visible={!!ed} title={ed?.id ? 'Edit note' : 'New note'} onDismiss={() => setEd(null)} confirmLabel="Save" onConfirm={save}>
        {ed && <>
          <OutlinedField placeholder="Title" value={ed.title} onChangeText={v => setEd({ ...ed, title: v })} />
          <View style={{ height: 10 }} />
          <OutlinedField placeholder="What's on your mind?" multiline value={ed.content} onChangeText={v => setEd({ ...ed, content: v })} inputStyle={{ minHeight: 100 }} />
        </>}
      </Dialog>
    </View>
  );
}
