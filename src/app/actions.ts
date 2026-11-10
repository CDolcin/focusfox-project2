import {
  Card,
  Deck,
  Flower,
  FocusSession,
  SyncRecord,
  Task,
} from '../core/models';
import { SyncEngine } from '../core/sync';
import {
  awardForSession,
  awardForTask,
} from '../core/focus/garden';
import { dayKey } from '../core/focus/streak';
import { SessionResult } from '../core/focus/timer';
import { createId } from '../core/ids';

export const tzOffset = () =>
  new Date().getTimezoneOffset();

/**
 * Plant a flower if the rules allow.
 * Existing flower IDs prevent duplicate awards.
 */
export async function plant(
  engine: SyncEngine,
  award: { id: string; data: Flower } | null
): Promise<Flower | null> {
  if (!award) return null;

  if (await engine.get('flowers', award.id)) {
    return null;
  }

  await engine.upsert(
    'flowers',
    award.id,
    award.data
  );

  return award.data;
}

/**
 * Save a focus session with its selected module.
 * A null moduleId means General study.
 */
export async function recordFocusSession(
  engine: SyncEngine,
  r: SessionResult,
  moduleId: string | null = null
): Promise<{
  sessionId: string;
  flower: Flower | null;
}> {
  const sessionId = createId('ses');

  await engine.upsert('sessions', sessionId, {
    moduleId,
    label: r.label,
    plannedMinutes: r.plannedMinutes,
    actualMinutes: r.actualMinutes,
    completed: r.completed,
    startedAtMs: r.startedAtMs,
    endedAtMs: r.endedAtMs,
  } satisfies FocusSession);

  const flower = await plant(
    engine,
    awardForSession(
      sessionId,
      r,
      dayKey(r.endedAtMs, tzOffset())
    )
  );

  return { sessionId, flower };
}

/**
 * Update task completion and award a task flower
 * when the existing garden rules allow it.
 */
export async function setTaskCompleted(
  engine: SyncEngine,
  id: string,
  task: SyncRecord<Task>,
  completed: boolean,
  now = Date.now()
): Promise<Flower | null> {
  await engine.patch('tasks', id, {
    completed,
    completedAtMs: completed ? now : null,
  });

  if (!completed) return null;

  const existing = await engine.list('flowers');

  return plant(
    engine,
    awardForTask(
      id,
      task,
      now,
      dayKey(now, tzOffset()),
      existing
    )
  );
}

/**
 * Delete a deck and its cards.
 */
export async function deleteDeck(
  engine: SyncEngine,
  deckId: string
) {
  const cards = (await engine.list('cards')).filter(
    card => card.deckId === deckId
  );

  for (const card of cards) {
    await engine.remove('cards', card.id);
  }

  await engine.remove('decks', deckId);
}

/**
 * Default values for a new task.
 */
export const newTask = (
  now = Date.now()
): Task => ({
  title: '',
  description: '',
  priority: 'MEDIUM',
  deadlineMs: now + 86_400_000,
  reminderMinutesBefore: 15,
  completed: false,
  completedAtMs: null,
  createdAtMs: now,
  imageUris: [],
  imagePaths: [],
});

export type CardRow = SyncRecord<Card>;
export type DeckRow = SyncRecord<Deck>;