import { FocusSession } from '../models';
import { dayKey } from './streak';

/**
 * Completed focus minutes per local day.
 * Returns the last `days` days, oldest first.
 */
export function dailyMinutes(
  sessions: Array<
    Pick<
      FocusSession,
      'completed' | 'actualMinutes' | 'startedAtMs'
    >
  >,
  nowMs: number,
  tz: number,
  days: number
): Array<{ day: string; minutes: number }> {
  const totals = new Map<string, number>();

  for (const session of sessions) {
    if (!session.completed) continue;

    const key = dayKey(session.startedAtMs, tz);

    totals.set(
      key,
      (totals.get(key) ?? 0) + session.actualMinutes
    );
  }

  const result: Array<{ day: string; minutes: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(nowMs - i * 86_400_000, tz);

    result.push({
      day: key,
      minutes: totals.get(key) ?? 0,
    });
  }

  return result;
}

/**
 * Monthly totals of completed focus minutes.
 * Month format: YYYY-MM. Oldest month first.
 */
export function monthlyMinutes(
  sessions: Array<
    Pick<
      FocusSession,
      'completed' | 'actualMinutes' | 'startedAtMs'
    >
  >,
  tz: number
): Array<{ month: string; minutes: number }> {
  const totals = new Map<string, number>();

  for (const session of sessions) {
    if (!session.completed) continue;

    const month = dayKey(session.startedAtMs, tz).slice(0, 7);

    totals.set(
      month,
      (totals.get(month) ?? 0) + session.actualMinutes
    );
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, minutes]) => ({
      month,
      minutes,
    }));
}

/**
 * Current flashcard mastery for each deck/module.
 */
export function masteryByDeck(
  decks: Array<{ id: string; name: string }>,
  cards: Array<{ deckId: string; mastered: boolean }>
) {
  return decks.map(deck => {
    const moduleCards = cards.filter(
      card => card.deckId === deck.id
    );

    return {
      deckId: deck.id,
      name: deck.name,
      total: moduleCards.length,
      mastered: moduleCards.filter(card => card.mastered).length,
    };
  });
}

/**
 * Focus time per module for the selected month,
 * together with each module's current flashcard mastery.
 *
 * Sessions without a module, or linked to a removed module,
 * are included under General / removed modules.
 */
export function moduleAnalytics(
  decks: Array<{ id: string; name: string }>,
  cards: Array<{ deckId: string; mastered: boolean }>,
  sessions: Array<
    Pick<
      FocusSession,
      'moduleId' | 'completed' | 'actualMinutes' | 'startedAtMs'
    >
  >,
  month: string,
  tz: number
) {
  const rows = decks.map(deck => ({
    id: deck.id,
    name: deck.name,
    minutes: 0,
    total: 0,
    mastered: 0,
  }));

  const general = {
    id: '',
    name: 'General / removed modules',
    minutes: 0,
    total: 0,
    mastered: 0,
  };

  // Calculate current mastery.
  for (const card of cards) {
    const row = rows.find(module => module.id === card.deckId);

    if (!row) continue;

    row.total += 1;

    if (card.mastered) {
      row.mastered += 1;
    }
  }

  // Calculate completed focus minutes in the selected month.
  for (const session of sessions) {
    if (!session.completed) continue;

    const sessionMonth = dayKey(
      session.startedAtMs,
      tz
    ).slice(0, 7);

    if (sessionMonth !== month) continue;

    const row =
      rows.find(module => module.id === session.moduleId) ??
      general;

    row.minutes += session.actualMinutes;
  }

  return [...rows, general];
}