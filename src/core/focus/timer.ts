/**
 * Pomodoro timer as a pure state machine driven by timestamps (not by setInterval counts), so it stays correct
 * when the app is backgrounded or the phone sleeps: remaining time is always derived from `now`.
 */
export type Phase = 'focus' | 'break';
export type Status = 'idle' | 'running' | 'paused' | 'completed' | 'abandoned';

export interface TimerState {
  phase: Phase;
  status: Status;
  plannedMs: number;
  /** Time already accumulated before the current run segment. */
  elapsedBeforeMs: number;
  /** When the current run segment began (null unless running). */
  segmentStartMs: number | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
}

export const minutes = (m: number) => m * 60_000;

export function idle(phase: Phase, plannedMinutes: number): TimerState {
  return { phase, status: 'idle', plannedMs: minutes(plannedMinutes), elapsedBeforeMs: 0, segmentStartMs: null, startedAtMs: null, endedAtMs: null };
}

export function elapsedMs(s: TimerState, now: number): number {
  const live = s.status === 'running' && s.segmentStartMs !== null ? now - s.segmentStartMs : 0;
  return Math.min(s.plannedMs, s.elapsedBeforeMs + Math.max(0, live));
}
export const remainingMs = (s: TimerState, now: number) => Math.max(0, s.plannedMs - elapsedMs(s, now));

export function start(s: TimerState, now: number): TimerState {
  if (s.status !== 'idle') return s;
  return { ...s, status: 'running', segmentStartMs: now, startedAtMs: now };
}
export function pause(s: TimerState, now: number): TimerState {
  if (s.status !== 'running') return s;
  return { ...s, status: 'paused', elapsedBeforeMs: elapsedMs(s, now), segmentStartMs: null };
}
export function resume(s: TimerState, now: number): TimerState {
  if (s.status !== 'paused') return s;
  return { ...s, status: 'running', segmentStartMs: now };
}
/** Call on every UI tick or app foreground event: completes the session once the planned time has elapsed. */
export function tick(s: TimerState, now: number): TimerState {
  if (s.status === 'running' && remainingMs(s, now) === 0) {
    const end = (s.segmentStartMs ?? now) + (s.plannedMs - s.elapsedBeforeMs);
    return { ...s, status: 'completed', elapsedBeforeMs: s.plannedMs, segmentStartMs: null, endedAtMs: end };
  }
  return s;
}
export function abandon(s: TimerState, now: number): TimerState {
  if (s.status !== 'running' && s.status !== 'paused') return s;
  return { ...s, status: 'abandoned', elapsedBeforeMs: elapsedMs(s, now), segmentStartMs: null, endedAtMs: now };
}

/** Wall-clock time at which a running timer will finish: used to schedule the end-of-session notification. */
export function finishesAtMs(s: TimerState, now: number): number | null {
  return s.status === 'running' ? now + remainingMs(s, now) : null;
}

export interface SessionResult {
  label: string; plannedMinutes: number; actualMinutes: number; completed: boolean; startedAtMs: number; endedAtMs: number;
}
/** Convert a finished focus run into the record that is saved/synced. Break phases and idle timers produce nothing. */
export function toSessionResult(s: TimerState, label: string, now: number): SessionResult | null {
  if (s.phase !== 'focus' || s.startedAtMs === null || (s.status !== 'completed' && s.status !== 'abandoned')) return null;
  return {
    label, plannedMinutes: Math.round(s.plannedMs / 60_000),
    actualMinutes: Math.floor(elapsedMs(s, now) / 60_000),
    completed: s.status === 'completed', startedAtMs: s.startedAtMs, endedAtMs: s.endedAtMs ?? now,
  };
}
