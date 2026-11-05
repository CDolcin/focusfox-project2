import { FocusSession } from '../models';

/** yyyy-mm-dd for the user's LOCAL calendar day. `tzOffsetMinutes` follows Date#getTimezoneOffset (minutes WEST of UTC). */
export function dayKey(ms: number, tzOffsetMinutes: number): string {
  const d = new Date(ms - tzOffsetMinutes * 60_000);
  return d.toISOString().slice(0, 10);
}
export function previousDayKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Streak rule carried over from Project I: count back from TODAY through consecutive days that have at least one
 * COMPLETED focus session. Tasks and flashcards do not affect it.
 * `graceYesterday` (default off, matching Project I) keeps a streak alive until the end of the day: if today has no
 * session yet, counting starts from yesterday.
 */
export function currentStreak(sessions: Array<Pick<FocusSession, 'completed' | 'startedAtMs'>>, nowMs: number, tzOffsetMinutes: number, graceYesterday = false): number {
  const days = new Set(sessions.filter(s => s.completed).map(s => dayKey(s.startedAtMs, tzOffsetMinutes)));
  let key = dayKey(nowMs, tzOffsetMinutes);
  if (!days.has(key) && graceYesterday) key = previousDayKey(key);
  let n = 0;
  while (days.has(key)) { n++; key = previousDayKey(key); }
  return n;
}
