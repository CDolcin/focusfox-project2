import { FocusSession } from '../models';
import { dayKey } from './streak';

/** Minutes of COMPLETED focus per local day, for the last `days` days ending today (oldest first). */
export function dailyMinutes(sessions: Array<Pick<FocusSession, 'completed' | 'actualMinutes' | 'startedAtMs'>>, nowMs: number, tz: number, days: number): Array<{ day: string; minutes: number }> {
  const totals = new Map<string, number>();
  for (const s of sessions) if (s.completed) { const k = dayKey(s.startedAtMs, tz); totals.set(k, (totals.get(k) ?? 0) + s.actualMinutes); }
  const out: Array<{ day: string; minutes: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(nowMs - i * 86_400_000, tz);
    out.push({ day: k, minutes: totals.get(k) ?? 0 });
  }
  return out;
}

/** Monthly totals (yyyy-mm) of completed focus minutes, newest month last. Optional feature: monthly analytics. */
export function monthlyMinutes(sessions: Array<Pick<FocusSession, 'completed' | 'actualMinutes' | 'startedAtMs'>>, tz: number): Array<{ month: string; minutes: number }> {
  const totals = new Map<string, number>();
  for (const s of sessions) if (s.completed) { const k = dayKey(s.startedAtMs, tz).slice(0, 7); totals.set(k, (totals.get(k) ?? 0) + s.actualMinutes); }
  return [...totals.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, minutes]) => ({ month, minutes }));
}

/** Per-deck mastery for the analytics screen. */
export function masteryByDeck(decks: Array<{ id: string; name: string }>, cards: Array<{ deckId: string; mastered: boolean }>) {
  return decks.map(d => {
    const mine = cards.filter(c => c.deckId === d.id);
    return { deckId: d.id, name: d.name, total: mine.length, mastered: mine.filter(c => c.mastered).length };
  });
}
