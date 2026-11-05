import { Card, Deck, Flower, FocusSession, SyncRecord, Task } from '../core/models';
import { SyncEngine } from '../core/sync';
import { awardForSession, awardForTask } from '../core/focus/garden';
import { dayKey } from '../core/focus/streak';
import { SessionResult } from '../core/focus/timer';
import { createId } from '../core/ids';

export const tzOffset = () => new Date().getTimezoneOffset();

/** Plant a flower if the rules allow. Deterministic ids mean the same award made on two devices merges into one flower. */
export async function plant(engine: SyncEngine, award: { id: string; data: Flower } | null): Promise<Flower | null> {
  if (!award) return null;
  if (await engine.get('flowers', award.id)) return null;
  await engine.upsert('flowers', award.id, award.data);
  return award.data;
}

export async function recordFocusSession(engine: SyncEngine, r: SessionResult): Promise<{ sessionId: string; flower: Flower | null }> {
  const sessionId = createId('ses');
  await engine.upsert('sessions', sessionId, { label: r.label, plannedMinutes: r.plannedMinutes, actualMinutes: r.actualMinutes, completed: r.completed, startedAtMs: r.startedAtMs, endedAtMs: r.endedAtMs } satisfies FocusSession);
  const flower = await plant(engine, awardForSession(sessionId, r, dayKey(r.endedAtMs, tzOffset())));
  return { sessionId, flower };
}

export async function setTaskCompleted(engine: SyncEngine, id: string, task: SyncRecord<Task>, completed: boolean, now = Date.now()): Promise<Flower | null> {
  await engine.patch('tasks', id, { completed, completedAtMs: completed ? now : null });
  if (!completed) return null;
  const existing = await engine.list('flowers');
  return plant(engine, awardForTask(id, task, now, dayKey(now, tzOffset()), existing));
}

export async function deleteDeck(engine: SyncEngine, deckId: string) {
  const cards = (await engine.list('cards')).filter(c => c.deckId === deckId);
  for (const c of cards) await engine.remove('cards', c.id);
  await engine.remove('decks', deckId);
}

export const newTask = (now = Date.now()): Task => ({ title: '', description: '', priority: 'MEDIUM', deadlineMs: now + 86_400_000, reminderMinutesBefore: 15, completed: false, completedAtMs: null, createdAtMs: now, imageUris: [], imagePaths: [] });
export type CardRow = SyncRecord<Card>;
export type DeckRow = SyncRecord<Deck>;
