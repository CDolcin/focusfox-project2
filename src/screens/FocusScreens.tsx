import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, Vibration, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp, useCollection } from '../app/AppContext';
import { recordFocusSession, tzOffset } from '../app/actions';
import * as T_ from '../core/focus/timer';
import { dailyMinutes } from '../core/focus/analytics';
import { cancelByKey, scheduleTimerEnd } from '../services/notifications';
import { BackableHeader, Dialog, Empty, OutlinedField, OutlinedPill, PillBadge, PrimaryButton, Row, Screen, StripeRow, T, useColors } from '../ui/kit';
import { FOCUS_BACKGROUNDS, colors, flowerEmoji } from '../ui/theme';

const KEY = 'ff:timer:v2';
interface Saved { phase: T_.Phase; session: number; state: T_.TimerState; label: string }
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/** Project I Focus tab: circular Pomodoro (focus -> break -> next session of N), goal/break pills, reset, history, background picker. */
export function FocusScreen({ onBack, onHistory, onGarden }: { onBack: () => void; onHistory: () => void; onGarden: () => void }) {
  const { engine, settings, updateSettings } = useApp(); const c = useColors();
  const sessions = useCollection('sessions');
  const history = [...sessions].sort((a, b) => b.startedAtMs - a.startedAtMs).slice(0, 10);
  const [state, setState] = useState<T_.TimerState>(() => T_.idle('focus', settings.focusMinutes));
  const [session, setSession] = useState(1);
  const [label, setLabel] = useState('Study session');
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState<string | null>(null);
  const [dlg, setDlg] = useState<null | 'settings' | 'bg' | 'rename'>(null);
  const [form, setForm] = useState({ f: '', b: '', s: '' });
  const [name, setName] = useState('');
  const settled = useRef(false);
  const bg = FOCUS_BACKGROUNDS[settings.backgroundChoice] ?? FOCUS_BACKGROUNDS[0]; const dark = settings.backgroundChoice === 5;
  const running = state.status === 'running';

  // restore a timer that was running when the app was closed
  useEffect(() => { AsyncStorage.getItem(KEY).then(raw => { if (!raw) return; const s: Saved = JSON.parse(raw); setState(s.state); setSession(s.session); setLabel(s.label); }).catch(() => undefined); }, []);
  const commit = useCallback((s: T_.TimerState, sess = session, l = label) => { setState(s); setSession(sess); settled.current = false; AsyncStorage.setItem(KEY, JSON.stringify({ phase: s.phase, session: sess, state: s, label: l } satisfies Saved)).catch(() => undefined); }, [session, label]);
  // when idle, follow the default lengths from Study preferences
  useEffect(() => { if (state.status === 'idle') setState(T_.idle(state.phase, state.phase === 'focus' ? settings.focusMinutes : settings.breakMinutes)); }, [settings.focusMinutes, settings.breakMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  const onComplete = useCallback(async (s: T_.TimerState) => {
    if (settled.current) return; settled.current = true;
    if (s.phase === 'focus' && engine) {
      const r = T_.toSessionResult(s, label, Date.now());
      if (r) { const { flower } = await recordFocusSession(engine, r); setMsg(flower ? `${flowerEmoji[flower.species]} Session complete — a ${flower.species} grew in your garden!` : 'Session complete ✓'); }
      commit(T_.idle('break', settings.breakMinutes));
    } else {
      const nextSession = session < settings.sessionsGoal ? session + 1 : 1;
      commit(T_.idle('focus', settings.focusMinutes), nextSession);
    }
    Vibration.vibrate(400);
  }, [engine, label, settings, session, commit]);

  useEffect(() => {
    const id = setInterval(() => { const t = Date.now(); setNow(t); if (state.status === 'running') { const n = T_.tick(state, t); if (n.status === 'completed') void onComplete(n); } }, 500);
    return () => clearInterval(id);
  }, [state, onComplete]);

  const start = async () => { setMsg(null); const s = T_.start(state, Date.now()); commit(s); const end = T_.finishesAtMs(s, Date.now()); if (end && settings.notificationsEnabled) await scheduleTimerEnd(label, end, s.phase === 'break'); };
  const pause = async () => { commit(T_.pause(state, Date.now())); await cancelByKey('timer'); };
  const resume = async () => { const s = T_.resume(state, Date.now()); commit(s); const end = T_.finishesAtMs(s, Date.now()); if (end && settings.notificationsEnabled) await scheduleTimerEnd(label, end, s.phase === 'break'); };
  const reset = async () => { await cancelByKey('timer'); setMsg(null); commit(T_.idle('focus', settings.focusMinutes), 1); };

  const total = Math.max(1, Math.round(state.plannedMs / 1000));
  const left = Math.ceil(T_.remainingMs(state, now) / 1000);
  const progress = 1 - Math.min(1, left / total);
  const R = 120, C = 2 * Math.PI * R;
  const fg = dark ? '#fff' : c.text;

  return (
    <Screen bg={bg}>
      <Row style={{ justifyContent: 'space-between' }}>
        <BackableHeader title="Focus Session" subtitle="" onBack={onBack} style={{ flex: 1 }} />
        <PillBadge text={running ? '● RUNNING' : '● READY'} bg={c.onlineBg} color={c.onlineText} />
      </Row>
      <Pressable onPress={() => { setName(label); setDlg('rename'); }} style={{ flexDirection: 'row', marginTop: 4 }}>
        <T kind="bodyDim" style={dark ? { color: 'rgba(255,255,255,0.85)' } : undefined}>{label}</T>
        <Text style={{ color: c.purple, fontSize: 12, marginLeft: 8, fontWeight: '500' }}>✎ rename</Text>
      </Pressable>
      <View style={{ height: 28 }} />
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={260} height={260} style={{ position: 'absolute' }}>
            <Circle cx={130} cy={130} r={R} stroke={c.purpleLight} strokeWidth={18} fill="none" />
            <Circle cx={130} cy={130} r={R} stroke={c.purple} strokeWidth={18} fill="none" strokeLinecap="round" strokeDasharray={`${C * progress} ${C}`} transform="rotate(-90 130 130)" />
          </Svg>
          <Text style={{ fontSize: 48, fontWeight: '800', color: c.purple }} accessibilityLabel={`${mmss(left)} remaining`}>{mmss(left)}</Text>
          <Text style={{ fontWeight: '600', fontSize: 14, color: fg }}>{state.phase === 'focus' ? 'FOCUS' : 'BREAK'}</Text>
        </View>
      </View>
      <T kind="bodyDim" style={{ alignSelf: 'center', marginTop: 16, ...(dark ? { color: 'rgba(255,255,255,0.7)' } : {}) }}>Pomodoro · Session {session} of {settings.sessionsGoal}</T>
      <View style={{ height: 20 }} />
      <PrimaryButton title={running ? 'Pause' : state.status === 'paused' ? 'Resume' : 'Start'} onPress={running ? pause : state.status === 'paused' ? resume : start} />
      <View style={{ height: 14 }} />
      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <PillBadge text={`✓ ${settings.focusMinutes} min goal`} bg={c.purpleLight} color={c.purple} onPress={() => { setForm({ f: `${settings.focusMinutes}`, b: `${settings.breakMinutes}`, s: `${settings.sessionsGoal}` }); setDlg('settings'); }} />
        <PillBadge text={`♣ ${settings.breakMinutes} min break`} bg={c.purpleLight} color={c.purple} onPress={() => { setForm({ f: `${settings.focusMinutes}`, b: `${settings.breakMinutes}`, s: `${settings.sessionsGoal}` }); setDlg('settings'); }} />
        <PillBadge text="⚙ Reset" bg="#fff" color={colors.text} onPress={reset} />
      </Row>
      <View style={{ height: 8 }} />
      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <OutlinedPill title="📅 Daily history" onPress={onHistory} />
        <OutlinedPill title="🎨 Background" onPress={() => setDlg('bg')} />
        <OutlinedPill title="🌷 Garden" onPress={onGarden} />
      </Row>
      {msg ? <View style={{ backgroundColor: c.purpleLight, borderRadius: 14, padding: 14, marginTop: 16 }}><T kind="label" style={{ color: c.purple }}>{msg}</T></View> : null}
      <View style={{ height: 24 }} />
      <T kind="titleLarge" style={dark ? { color: '#fff' } : undefined}>Session history</T>
      <View style={{ height: 10 }} />
      {history.length === 0 ? <T kind="bodyDim">No sessions completed yet.</T> : (
        <View style={{ gap: 10 }}>
          {history.map(s => <StripeRow key={s.id} stripe={colors.green}><Text style={{ fontWeight: '600', fontSize: 16, color: colors.text }}>{s.label}</Text><T kind="bodyDim">{s.actualMinutes} min · {s.completed ? 'Completed ✓' : 'Incomplete'}</T></StripeRow>)}
        </View>
      )}

      <Dialog visible={dlg === 'settings'} title="Pomodoro settings" onDismiss={() => setDlg(null)} confirmLabel="Save" onConfirm={async () => {
        const clamp = (v: string, lo: number, hi: number, d: number) => Math.min(hi, Math.max(lo, parseInt(v, 10) || d));
        await updateSettings({ focusMinutes: clamp(form.f, 1, 180, settings.focusMinutes), breakMinutes: clamp(form.b, 1, 60, settings.breakMinutes), sessionsGoal: clamp(form.s, 1, 12, settings.sessionsGoal) }); setDlg(null);
      }}>
        <OutlinedField label="Focus length (minutes)" keyboardType="number-pad" value={form.f} onChangeText={v => setForm({ ...form, f: v.replace(/\D/g, '') })} />
        <View style={{ height: 10 }} />
        <OutlinedField label="Break length (minutes)" keyboardType="number-pad" value={form.b} onChangeText={v => setForm({ ...form, b: v.replace(/\D/g, '') })} />
        <View style={{ height: 10 }} />
        <OutlinedField label="Sessions per cycle" keyboardType="number-pad" value={form.s} onChangeText={v => setForm({ ...form, s: v.replace(/\D/g, '') })} />
      </Dialog>
      <Dialog visible={dlg === 'rename'} title="Name this session" onDismiss={() => setDlg(null)} confirmLabel="Save" onConfirm={() => { const l = name.trim() || 'Study session'; setLabel(l); commit(state, session, l); setDlg(null); }}>
        <OutlinedField value={name} onChangeText={setName} />
      </Dialog>
      <Dialog visible={dlg === 'bg'} title="Choose a background" onDismiss={() => setDlg(null)} hideDismiss confirmLabel="Done" onConfirm={() => setDlg(null)}>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          {FOCUS_BACKGROUNDS.map((col, i) => <Pressable key={col} accessibilityLabel={`Background ${i + 1}`} onPress={async () => { await updateSettings({ backgroundChoice: i }); setDlg(null); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: col, borderWidth: 1, borderColor: c.border }} />)}
        </Row>
      </Dialog>
    </Screen>
  );
}

export function FocusHistoryScreen({ onBack }: { onBack: () => void }) {
  const sessions = useCollection('sessions'); const c = useColors();
  const totals = dailyMinutes(sessions, Date.now(), tzOffset(), 30).filter(d => d.minutes > 0).reverse();
  return (
    <Screen>
      <BackableHeader title="Daily History" subtitle="How many hours you've studied, per day" onBack={onBack} />
      <View style={{ height: 16 }} />
      {totals.length === 0 ? <Empty text="No completed sessions yet — finish a Focus session to see it here." /> : (
        <View style={{ gap: 10 }}>
          {totals.map(d => (
            <Row key={d.day} style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '600', fontSize: 16, color: c.text }}>{new Date(d.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
              <T kind="bodyDim">{d.minutes >= 60 ? `${Math.floor(d.minutes / 60)}h ${d.minutes % 60}m` : `${d.minutes}m`}</T>
            </Row>
          ))}
        </View>
      )}
    </Screen>
  );
}
