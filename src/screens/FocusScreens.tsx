import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Pressable, Text, Vibration, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useApp, useCollection } from '../app/AppContext';
import { recordFocusSession, tzOffset } from '../app/actions';
import * as T_ from '../core/focus/timer';
import { dailyMinutes } from '../core/focus/analytics';
import {
  cancelByKey,
  scheduleTimerEnd,
} from '../services/notifications';
import {
  BackableHeader,
  Dialog,
  Empty,
  OutlinedField,
  OutlinedPill,
  PillBadge,
  PrimaryButton,
  Row,
  Screen,
  StripeRow,
  T,
  useColors,
} from '../ui/kit';
import {
  FOCUS_BACKGROUNDS,
  colors,
  flowerEmoji,
} from '../ui/theme';

const KEY = 'ff:timer:v2';

interface Saved {
  phase: T_.Phase;
  session: number;
  state: T_.TimerState;
  label: string;
  moduleId?: string | null;
}

const mmss = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60
  ).padStart(2, '0')}`;

export function FocusScreen({
  onBack,
  onHistory,
  onGarden,
}: {
  onBack: () => void;
  onHistory: () => void;
  onGarden: () => void;
}) {
  const { engine, settings, updateSettings } = useApp();
  const c = useColors();

  const sessions = useCollection('sessions');
  const decks = useCollection('decks');

  const history = [...sessions]
    .sort((a, b) => b.startedAtMs - a.startedAtMs)
    .slice(0, 10);

  const [state, setState] = useState<T_.TimerState>(() =>
    T_.idle('focus', settings.focusMinutes)
  );
  const [session, setSession] = useState(1);
  const [label, setLabel] = useState('Study session');
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState<string | null>(null);

  const [dlg, setDlg] = useState<
    null | 'settings' | 'bg' | 'rename'
  >(null);

  const [form, setForm] = useState({
    f: '',
    b: '',
    s: '',
  });
  const [name, setName] = useState('');

  const settled = useRef(false);

  const bg =
    FOCUS_BACKGROUNDS[settings.backgroundChoice] ??
    FOCUS_BACKGROUNDS[0];

  const dark = settings.backgroundChoice === 5;
  const running = state.status === 'running';

  const selectedModuleName = moduleId
    ? decks.find(deck => deck.id === moduleId)?.name ??
      'Removed module'
    : 'General study';

  // Restore the timer and its selected module.
  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);

        if (!raw || !active) return;

        const saved: Saved = JSON.parse(raw);

        setState(saved.state);
        setSession(saved.session);
        setLabel(saved.label);
        setModuleId(saved.moduleId ?? null);
      } catch {
        // If saved data cannot be read, use the default timer.
      } finally {
        if (active) setRestored(true);
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, []);

  const commit = useCallback(
    (
      nextState: T_.TimerState,
      nextSession = session,
      nextLabel = label,
      nextModuleId = moduleId
    ) => {
      setState(nextState);
      setSession(nextSession);
      setModuleId(nextModuleId);
      settled.current = false;

      const saved: Saved = {
        phase: nextState.phase,
        session: nextSession,
        state: nextState,
        label: nextLabel,
        moduleId: nextModuleId,
      };

      void AsyncStorage.setItem(
        KEY,
        JSON.stringify(saved)
      ).catch(() => undefined);
    },
    [session, label, moduleId]
  );

  // Follow preference changes while the timer is idle.
  useEffect(() => {
    setState(current => {
      if (current.status !== 'idle') return current;

      return T_.idle(
        current.phase,
        current.phase === 'focus'
          ? settings.focusMinutes
          : settings.breakMinutes
      );
    });
  }, [settings.focusMinutes, settings.breakMinutes]);

  const onComplete = useCallback(
    async (completedState: T_.TimerState) => {
      if (settled.current) return;

      // Wait for the local database before saving a focus run.
      if (completedState.phase === 'focus' && !engine) return;

      settled.current = true;

      try {
        if (completedState.phase === 'focus' && engine) {
          const result = T_.toSessionResult(
            completedState,
            label,
            Date.now()
          );

          if (result) {
            const { flower } = await recordFocusSession(
              engine,
              result,
              moduleId
            );

            setMsg(
              flower
                ? `${flowerEmoji[flower.species]} Session complete — a ${flower.species} grew in your garden!`
                : 'Session complete ✓'
            );
          }

          commit(T_.idle('break', settings.breakMinutes));
        } else {
          const nextSession =
            session < settings.sessionsGoal
              ? session + 1
              : 1;

          commit(
            T_.idle('focus', settings.focusMinutes),
            nextSession
          );
        }

        Vibration.vibrate(400);
      } catch (error) {
        setMsg(
          `Could not save the session: ${
            (error as Error).message
          }`
        );
      }
    },
    [engine, label, moduleId, settings, session, commit]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const time = Date.now();
      setNow(time);

      if (restored && state.status === 'running') {
        const next = T_.tick(state, time);

        if (next.status === 'completed') {
          void onComplete(next);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [state, restored, onComplete]);

  const selectModule = (id: string | null) => {
    if (!restored || state.status !== 'idle') return;

    commit(state, session, label, id);
  };

  const start = async () => {
    if (!restored || !engine) return;

    setMsg(null);

    const next = T_.start(state, Date.now());
    commit(next);

    const end = T_.finishesAtMs(next, Date.now());

    if (end && settings.notificationsEnabled) {
      await scheduleTimerEnd(
        label,
        end,
        next.phase === 'break'
      );
    }
  };

  const pause = async () => {
    commit(T_.pause(state, Date.now()));
    await cancelByKey('timer');
  };

  const resume = async () => {
    const next = T_.resume(state, Date.now());
    commit(next);

    const end = T_.finishesAtMs(next, Date.now());

    if (end && settings.notificationsEnabled) {
      await scheduleTimerEnd(
        label,
        end,
        next.phase === 'break'
      );
    }
  };

  const reset = async () => {
    await cancelByKey('timer');
    setMsg(null);

    commit(
      T_.idle('focus', settings.focusMinutes),
      1
    );
  };

  const openSettings = () => {
    setForm({
      f: `${settings.focusMinutes}`,
      b: `${settings.breakMinutes}`,
      s: `${settings.sessionsGoal}`,
    });

    setDlg('settings');
  };

  const total = Math.max(
    1,
    Math.round(state.plannedMs / 1000)
  );

  const left = Math.max(
    0,
    Math.ceil(T_.remainingMs(state, now) / 1000)
  );

  const progress = 1 - Math.min(1, left / total);
  const R = 120;
  const C = 2 * Math.PI * R;
  const fg = dark ? '#fff' : c.text;

  return (
    <Screen bg={bg}>
      <Row style={{ justifyContent: 'space-between' }}>
        <BackableHeader
          title="Focus Session"
          subtitle=""
          onBack={onBack}
          style={{ flex: 1 }}
        />

        <PillBadge
          text={running ? '● RUNNING' : '● READY'}
          bg={c.onlineBg}
          color={c.onlineText}
        />
      </Row>

      <Pressable
        onPress={() => {
          setName(label);
          setDlg('rename');
        }}
        style={{
          flexDirection: 'row',
          marginTop: 4,
        }}
      >
        <T
          kind="bodyDim"
          style={
            dark
              ? { color: 'rgba(255,255,255,0.85)' }
              : undefined
          }
        >
          {label}
        </T>

        <Text
          style={{
            color: c.purple,
            fontSize: 12,
            marginLeft: 8,
            fontWeight: '500',
          }}
        >
          ✎ rename
        </Text>
      </Pressable>

      {/* Module selection */}
      <View style={{ height: 16 }} />

      <T
        kind="label"
        style={dark ? { color: '#fff' } : undefined}
      >
        Focus module: {selectedModuleName}
      </T>

      <T
        kind="bodyDim"
        style={
          dark
            ? { color: 'rgba(255,255,255,0.7)' }
            : undefined
        }
      >
        {state.status === 'idle'
          ? 'Choose the module you will study before starting.'
          : 'The module stays fixed until this run ends or is reset.'}
      </T>

      <Row
        style={{
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 10,
        }}
      >
        <OutlinedPill
          title={`${
            moduleId === null ? '✓ ' : ''
          }General study`}
          onPress={() => selectModule(null)}
        />

        {decks.map(deck => (
          <OutlinedPill
            key={deck.id}
            title={`${
              moduleId === deck.id ? '✓ ' : ''
            }${deck.name}`}
            onPress={() => selectModule(deck.id)}
          />
        ))}
      </Row>

      {decks.length === 0 && (
        <T
          kind="bodyDim"
          style={{
            marginTop: 8,
            ...(dark
              ? { color: 'rgba(255,255,255,0.7)' }
              : {}),
          }}
        >
          Create a flashcard module to track its focus time.
        </T>
      )}

      <View style={{ height: 28 }} />

      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 260,
            height: 260,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg
            width={260}
            height={260}
            style={{ position: 'absolute' }}
          >
            <Circle
              cx={130}
              cy={130}
              r={R}
              stroke={c.purpleLight}
              strokeWidth={18}
              fill="none"
            />

            <Circle
              cx={130}
              cy={130}
              r={R}
              stroke={c.purple}
              strokeWidth={18}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C * progress} ${C}`}
              transform="rotate(-90 130 130)"
            />
          </Svg>

          <Text
            style={{
              fontSize: 48,
              fontWeight: '800',
              color: c.purple,
            }}
            accessibilityLabel={`${mmss(left)} remaining`}
          >
            {mmss(left)}
          </Text>

          <Text
            style={{
              fontWeight: '600',
              fontSize: 14,
              color: fg,
            }}
          >
            {state.phase === 'focus' ? 'FOCUS' : 'BREAK'}
          </Text>
        </View>
      </View>

      <T
        kind="bodyDim"
        style={{
          alignSelf: 'center',
          marginTop: 16,
          ...(dark
            ? { color: 'rgba(255,255,255,0.7)' }
            : {}),
        }}
      >
        Pomodoro · Session {session} of {settings.sessionsGoal}
      </T>

      <View style={{ height: 20 }} />

      <PrimaryButton
        title={
          !restored
            ? 'Loading timer…'
            : running
              ? 'Pause'
              : state.status === 'paused'
                ? 'Resume'
                : 'Start'
        }
        disabled={!restored || !engine}
        onPress={
          running
            ? pause
            : state.status === 'paused'
              ? resume
              : start
        }
      />

      <View style={{ height: 14 }} />

      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <PillBadge
          text={`✓ ${settings.focusMinutes} min goal`}
          bg={c.purpleLight}
          color={c.purple}
          onPress={openSettings}
        />

        <PillBadge
          text={`♣ ${settings.breakMinutes} min break`}
          bg={c.purpleLight}
          color={c.purple}
          onPress={openSettings}
        />

        <PillBadge
          text="⚙ Reset"
          bg="#fff"
          color={colors.text}
          onPress={reset}
        />
      </Row>

      <View style={{ height: 8 }} />

      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <OutlinedPill
          title="📅 Daily history"
          onPress={onHistory}
        />

        <OutlinedPill
          title="🎨 Background"
          onPress={() => setDlg('bg')}
        />

        <OutlinedPill
          title="🌷 Garden"
          onPress={onGarden}
        />
      </Row>

      {msg ? (
        <View
          style={{
            backgroundColor: c.purpleLight,
            borderRadius: 14,
            padding: 14,
            marginTop: 16,
          }}
        >
          <T kind="label" style={{ color: c.purple }}>
            {msg}
          </T>
        </View>
      ) : null}

      <View style={{ height: 24 }} />

      <T
        kind="titleLarge"
        style={dark ? { color: '#fff' } : undefined}
      >
        Session history
      </T>

      <View style={{ height: 10 }} />

      {history.length === 0 ? (
        <T kind="bodyDim">No sessions completed yet.</T>
      ) : (
        <View style={{ gap: 10 }}>
          {history.map(item => {
            const moduleName = item.moduleId
              ? decks.find(
                  deck => deck.id === item.moduleId
                )?.name ?? 'Removed module'
              : 'General study';

            return (
              <StripeRow
                key={item.id}
                stripe={colors.green}
              >
                <Text
                  style={{
                    fontWeight: '600',
                    fontSize: 16,
                    color: colors.text,
                  }}
                >
                  {item.label}
                </Text>

                <T kind="bodyDim">
                  {item.actualMinutes} min ·{' '}
                  {item.completed
                    ? 'Completed ✓'
                    : 'Incomplete'}
                </T>

                <T kind="bodyDim">
                  Module: {moduleName}
                </T>
              </StripeRow>
            );
          })}
        </View>
      )}

      <Dialog
        visible={dlg === 'settings'}
        title="Pomodoro settings"
        onDismiss={() => setDlg(null)}
        confirmLabel="Save"
        onConfirm={async () => {
          const clamp = (
            value: string,
            minimum: number,
            maximum: number,
            fallback: number
          ) =>
            Math.min(
              maximum,
              Math.max(
                minimum,
                parseInt(value, 10) || fallback
              )
            );

          await updateSettings({
            focusMinutes: clamp(
              form.f,
              1,
              180,
              settings.focusMinutes
            ),
            breakMinutes: clamp(
              form.b,
              1,
              60,
              settings.breakMinutes
            ),
            sessionsGoal: clamp(
              form.s,
              1,
              12,
              settings.sessionsGoal
            ),
          });

          setDlg(null);
        }}
      >
        <OutlinedField
          label="Focus length (minutes)"
          keyboardType="number-pad"
          value={form.f}
          onChangeText={value =>
            setForm({
              ...form,
              f: value.replace(/\D/g, ''),
            })
          }
        />

        <View style={{ height: 10 }} />

        <OutlinedField
          label="Break length (minutes)"
          keyboardType="number-pad"
          value={form.b}
          onChangeText={value =>
            setForm({
              ...form,
              b: value.replace(/\D/g, ''),
            })
          }
        />

        <View style={{ height: 10 }} />

        <OutlinedField
          label="Sessions per cycle"
          keyboardType="number-pad"
          value={form.s}
          onChangeText={value =>
            setForm({
              ...form,
              s: value.replace(/\D/g, ''),
            })
          }
        />
      </Dialog>

      <Dialog
        visible={dlg === 'rename'}
        title="Name this session"
        onDismiss={() => setDlg(null)}
        confirmLabel="Save"
        onConfirm={() => {
          const nextLabel =
            name.trim() || 'Study session';

          setLabel(nextLabel);
          commit(state, session, nextLabel);
          setDlg(null);
        }}
      >
        <OutlinedField
          value={name}
          onChangeText={setName}
        />
      </Dialog>

      <Dialog
        visible={dlg === 'bg'}
        title="Choose a background"
        onDismiss={() => setDlg(null)}
        hideDismiss
        confirmLabel="Done"
        onConfirm={() => setDlg(null)}
      >
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          {FOCUS_BACKGROUNDS.map((color, index) => (
            <Pressable
              key={color}
              accessibilityLabel={`Background ${index + 1}`}
              onPress={async () => {
                await updateSettings({
                  backgroundChoice: index,
                });
                setDlg(null);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: color,
                borderWidth: 1,
                borderColor: c.border,
              }}
            />
          ))}
        </Row>
      </Dialog>
    </Screen>
  );
}

export function FocusHistoryScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const sessions = useCollection('sessions');
  const c = useColors();

  const totals = dailyMinutes(
    sessions,
    Date.now(),
    tzOffset(),
    30
  )
    .filter(day => day.minutes > 0)
    .reverse();

  return (
    <Screen>
      <BackableHeader
        title="Daily History"
        subtitle="How many hours you've studied, per day"
        onBack={onBack}
      />

      <View style={{ height: 16 }} />

      {totals.length === 0 ? (
        <Empty text="No completed sessions yet — finish a Focus session to see it here." />
      ) : (
        <View style={{ gap: 10 }}>
          {totals.map(day => (
            <Row
              key={day.day}
              style={{
                backgroundColor: c.surface,
                borderRadius: 14,
                padding: 16,
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  fontSize: 16,
                  color: c.text,
                }}
              >
                {new Date(
                  day.day + 'T12:00:00'
                ).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>

              <T kind="bodyDim">
                {day.minutes >= 60
                  ? `${Math.floor(day.minutes / 60)}h ${
                      day.minutes % 60
                    }m`
                  : `${day.minutes}m`}
              </T>
            </Row>
          ))}
        </View>
      )}
    </Screen>
  );
}