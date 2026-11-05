import React, { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useCollection } from '../app/AppContext';
import { tzOffset } from '../app/actions';
import { monthlyMinutes } from '../core/focus/analytics';
import { MAX_TASK_FLOWERS_PER_DAY, layout, summarize } from '../core/focus/garden';
import { currentStreak } from '../core/focus/streak';
import { BackableHeader, Panel, Row, Screen, T, useColors } from '../ui/kit';
import { colors } from '../ui/theme';
import { FlowerSpecies } from '../core/models';
import { GardenScene, PlantIcon } from '../ui/GardenScene';

const Banner = ({ text }: { text: string }) => { const c = useColors(); return <View style={{ backgroundColor: c.purpleLight, borderRadius: 14, padding: 14, marginBottom: 12 }}><Text style={{ color: c.purple, fontWeight: '600' }}>{text}</Text></View>; };
function Breakdown({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const c = useColors();
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}><T>{label}</T><T kind="label" style={{ fontSize: 16 }}>{value} / {total}</T></Row>
      <View style={{ height: 8, marginTop: 8, borderRadius: 4, backgroundColor: color + '26', overflow: 'hidden' }}><View style={{ height: 8, width: `${total ? (value / total) * 100 : 0}%`, backgroundColor: color }} /></View>
    </View>
  );
}

/** Project I ProgressScreen + monthly focus totals and flower count (new). */
export function ProgressScreen({ onBack, onGarden }: { onBack: () => void; onGarden: () => void }) {
  const c = useColors();
  const tasks = useCollection('tasks'); const notes = useCollection('notes'); const cards = useCollection('cards'); const sessions = useCollection('sessions'); const flowers = useCollection('flowers');
  const done = sessions.filter(s => s.completed);
  const total = done.reduce((a, s) => a + s.actualMinutes, 0);
  const streak = currentStreak(sessions, Date.now(), tzOffset());
  const weekStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
  const weekly = useMemo(() => { const w = [0, 0, 0, 0, 0, 0, 0]; done.filter(s => s.startedAtMs >= weekStart).forEach(s => { w[Math.min(6, Math.floor((s.startedAtMs - weekStart) / 86_400_000))] += s.actualMinutes; }); return w; }, [done, weekStart]);
  const maxV = Math.max(1, ...weekly); const todayIdx = (new Date().getDay() + 6) % 7;
  const months = monthlyMinutes(sessions, tzOffset()).slice(-6); const mmax = Math.max(60, ...months.map(m => m.minutes));
  const tDone = tasks.filter(t => t.completed).length; const mastered = cards.filter(x => x.mastered).length;
  return (
    <Screen>
      <BackableHeader title="Your Progress" subtitle="Small steps become strong habits" onBack={onBack} />
      <View style={{ height: 16 }} />
      {tasks.length > 0 && tDone === tasks.length && <Banner text="All tasks completed today! 🎉" />}
      {cards.length > 0 && mastered === cards.length && <Banner text="You've mastered every flashcard! 🏆" />}
      <Row style={{ gap: 12, alignItems: 'stretch' }}>
        <View style={{ flex: 1, backgroundColor: c.purple, borderRadius: 18, padding: 18 }}>
          <Row><Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{streak}</Text><Text style={{ fontSize: 20 }}>  🔥</Text></Row>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>day streak</Text>
        </View>
        <Panel radius={18} style={{ flex: 1, padding: 18 }}><Text style={{ fontSize: 24, fontWeight: '800', color: c.text }}>{Math.floor(total / 60)}h {total % 60}m</Text><T kind="bodyDim">focus time</T></Panel>
      </Row>
      <View style={{ height: 24 }} />
      <T kind="titleLarge">This week</T>
      <View style={{ height: 10 }} />
      <Panel radius={18} style={{ padding: 20 }}>
        <Row style={{ height: 160, alignItems: 'flex-end', justifyContent: 'space-around' }}>
          {weekly.map((v, i) => (
            <View key={i} style={{ alignItems: 'center' }}>
              <View style={{ width: 20, height: Math.max(6, 120 * (v / maxV)), borderRadius: 6, backgroundColor: i === todayIdx ? c.purple : c.purpleLight }} />
              <T kind="bodyDim" style={{ marginTop: 6 }}>{'MTWTFSS'[i]}</T>
            </View>
          ))}
        </Row>
      </Panel>
      <View style={{ height: 24 }} />
      <T kind="titleLarge">Study breakdown</T>
      <View style={{ height: 12 }} />
      <Breakdown label="Tasks completed" value={tDone} total={tasks.length} color={c.purple} />
      <View style={{ height: 16 }} />
      <Breakdown label="Flashcards mastered" value={mastered} total={cards.length} color={c.blue} />
      <View style={{ height: 16 }} />
      <Row style={{ justifyContent: 'space-between' }}><T>Notes created</T><T kind="label" style={{ fontSize: 16 }}>{notes.length}</T></Row>
      <View style={{ height: 8 }} />
      <Row style={{ justifyContent: 'space-between' }}><T>Flowers grown</T><T kind="label" style={{ fontSize: 16, color: c.purple }} >{summarize(flowers).total} 🌷</T></Row>
      <View style={{ height: 24 }} />
      <T kind="titleLarge">Monthly focus</T>
      <View style={{ height: 10 }} />
      <Panel radius={18} style={{ padding: 18, gap: 10 }}>
        {months.length === 0 && <T kind="bodyDim">Complete a focus session to see monthly totals.</T>}
        {months.map(m => (
          <Row key={m.month} style={{ gap: 10 }}>
            <T kind="bodyDim" style={{ width: 66 }}>{m.month}</T>
            <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.blue + '26', overflow: 'hidden' }}><View style={{ height: 10, width: `${Math.max(3, (m.minutes / mmax) * 100)}%`, backgroundColor: c.blue }} /></View>
            <T kind="label" style={{ width: 56, textAlign: 'right' }}>{m.minutes >= 60 ? `${Math.floor(m.minutes / 60)}h ${m.minutes % 60}m` : `${m.minutes}m`}</T>
          </Row>
        ))}
      </Panel>
    </Screen>
  );
}

const SPECIES_LABEL: Array<{ species: FlowerSpecies; name: string; how: string }> = [
  { species: 'daisy', name: 'Daisy', how: 'Focus 10–24 min' }, { species: 'tulip', name: 'Tulip', how: 'Focus 25–49 min' }, { species: 'sunflower', name: 'Sunflower', how: 'Focus 50+ min' },
  { species: 'poppy', name: 'Poppy', how: 'Low-priority task' }, { species: 'rose', name: 'Rose', how: 'Medium task' }, { species: 'lotus', name: 'Lotus', how: 'High-priority task' },
];

export function GardenScreen({ onBack }: { onBack: () => void }) {
  const c = useColors(); const { width } = useWindowDimensions();
  const all = useCollection('flowers'); const flowers = layout(all); const s = summarize(flowers);
  const sceneW = Math.min(width - 40, 560);
  return (
    <Screen>
      <BackableHeader title="My Garden" subtitle="Every finished session and task grows a flower" onBack={onBack} />
      <View style={{ height: 16 }} />
      <View style={{ backgroundColor: c.purple, borderRadius: 20, padding: 20 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' }}>YOUR GARDEN</Text>
        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>{s.total} flower{s.total === 1 ? '' : 's'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{s.fromFocus} from focus sessions · {s.fromTasks} from tasks</Text>
      </View>
      <View style={{ height: 16 }} />
      <View style={{ borderRadius: 20, overflow: 'hidden', alignSelf: 'center' }}><GardenScene flowers={all} width={sceneW} /></View>
      {flowers.length === 0 && <T kind="bodyDim" style={{ textAlign: 'center', marginTop: 10 }}>Finish a focus session or complete a task to plant your first flower.</T>}
      <View style={{ height: 20 }} />
      <T kind="titleLarge">How flowers grow</T>
      <View style={{ height: 10 }} />
      <Panel style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
          {SPECIES_LABEL.map(sp => (
            <View key={sp.species} style={{ width: '33.3%', alignItems: 'center' }}>
              <PlantIcon species={sp.species} size={38} />
              <Text style={{ fontWeight: '600', color: c.text, fontSize: 13 }}>{sp.name} · {s.bySpecies[sp.species] ?? 0}</Text>
              <T kind="labelDim" style={{ fontSize: 10, textAlign: 'center' }}>{sp.how}</T>
            </View>
          ))}
        </View>
      </Panel>
      <View style={{ height: 10 }} />
      <Panel style={{ padding: 16, gap: 8 }}>
        <T kind="bodyDim">A focus session only grows a flower if it is finished (10+ minutes); stopping early grows nothing. One flower per task, up to {MAX_TASK_FLOWERS_PER_DAY} a day.</T>
        <T kind="bodyDim">No purchases and no luck — the same effort always grows the same flower, on every phone. The garden gets bigger as it fills up.</T>
      </Panel>
    </Screen>
  );
}
