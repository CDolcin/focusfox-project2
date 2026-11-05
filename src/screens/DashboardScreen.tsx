import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useApp, useCollection } from '../app/AppContext';
import { dayKey } from '../core/focus/streak';
import { tzOffset } from '../app/actions';
import { summarize } from '../core/focus/garden';
import { OnlineBadge, Panel, Row, Screen, StripeRow, T, useColors } from '../ui/kit';
import { colors } from '../ui/theme';

const weight = (p: string) => (p === 'HIGH' ? 3 : p === 'MEDIUM' ? 2 : 1);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

export default function DashboardScreen({ go }: { go: (route: string) => void }) {
  const { user, badge } = useApp(); const c = useColors();
  const tasks = useCollection('tasks'); const notes = useCollection('notes'); const cards = useCollection('cards');
  const sessions = useCollection('sessions'); const flowers = useCollection('flowers');
  const now = Date.now(); const tz = tzOffset();
  const todayKey = dayKey(now, tz);
  const completedFocus = sessions.filter(s => s.completed);
  const today = completedFocus.filter(s => dayKey(s.startedAtMs, tz) === todayKey).reduce((a, s) => a + s.actualMinutes, 0);
  const weekStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
  const week = completedFocus.filter(s => s.startedAtMs >= weekStart).reduce((a, s) => a + s.actualMinutes, 0);
  const priority = tasks.filter(t => !t.completed).sort((a, b) => weight(b.priority) - weight(a.priority) || a.deadlineMs - b.deadlineMs).slice(0, 3);
  const glance = (value: string, label: string) => <Panel radius={16} style={{ flex: 1, padding: 16 }}><Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>{value}</Text><T kind="bodyDim">{label}</T></Panel>;
  const chip = (text: string, filled: boolean, route: string) => (
    <Pressable key={text} onPress={() => go(route)} accessibilityRole="button" style={{ backgroundColor: filled ? c.purple : c.purpleLight, borderRadius: 50, paddingHorizontal: 16, paddingVertical: 10 }}>
      <Text style={{ color: filled ? '#fff' : c.purpleDark, fontWeight: '600', fontSize: 13 }}>{text}</Text>
    </Pressable>
  );
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T kind="headlineMedium">{greeting()}, {user?.displayName ?? 'there'}</T>
          <T kind="bodyDim">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</T>
        </View>
        <OnlineBadge state={badge} />
      </Row>
      <View style={{ height: 20 }} />
      <View style={{ backgroundColor: c.purple, borderRadius: 20, padding: 20 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>TODAY'S FOCUS</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 4 }}>Keep your momentum going.</Text>
        <Row style={{ alignItems: 'flex-end', marginTop: 12 }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{Math.floor(week / 60)}h {week % 60}m</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 6 }}>  focused this week</Text>
        </Row>
      </View>
      <View style={{ height: 20 }} />
      <T kind="titleLarge">Today at a glance</T>
      <View style={{ height: 10 }} />
      <Row style={{ gap: 12 }}>{glance(`${tasks.filter(t => t.completed).length}`, 'Tasks')}{glance(`${today}m`, 'Focus')}</Row>
      <View style={{ height: 12 }} />
      <Row style={{ gap: 12 }}>{glance(`${cards.length}`, 'Cards')}{glance(`${notes.length}`, 'Notes')}</Row>
      <View style={{ height: 12 }} />
      <Pressable onPress={() => go('Garden')} accessibilityRole="button">
        <Panel radius={16} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View><Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>🌷 {summarize(flowers).total}</Text><T kind="bodyDim">Flowers in your garden</T></View>
          <T kind="label" style={{ color: c.purple }}>Open garden</T>
        </Panel>
      </Pressable>
      <View style={{ height: 20 }} />
      <T kind="titleLarge">Priority tasks</T>
      <View style={{ height: 10 }} />
      {priority.length === 0 && <T kind="bodyDim">You're all caught up — no urgent tasks right now.</T>}
      <View style={{ gap: 10 }}>
        {priority.map(t => (
          <StripeRow key={t.id} stripe={t.priority === 'HIGH' ? colors.high : colors.medium}>
            <Text style={{ fontWeight: '600', fontSize: 16, color: c.text }}>{t.title}</Text>
            <T kind="bodyDim">{new Date(t.deadlineMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {t.priority[0] + t.priority.slice(1).toLowerCase()} priority</T>
          </StripeRow>
        ))}
      </View>
      <View style={{ height: 20 }} />
      <T kind="titleLarge">Quick actions</T>
      <View style={{ height: 10 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {chip('Add Quick Notes', true, 'Notes')}{chip('Your Progress', false, 'Progress')}{chip('Flashcards', false, 'FlashcardsManage')}{chip('My Garden', false, 'Garden')}
      </ScrollView>
    </Screen>
  );
}
