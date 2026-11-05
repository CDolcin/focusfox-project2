import { Flower, FlowerSpecies, FocusSession, Priority, SyncRecord, Task } from '../models';
import { flowerIdForSession, flowerIdForTask } from '../ids';

/**
 * GARDEN RULES: deterministic, no randomness, no purchases.
 *
 *  Focus session  -> one flower, ONLY when the session was completed (not abandoned) and lasted >= 10 minutes:
 *      10-24 min: daisy      25-49 min: tulip      50+ min: sunflower
 *  Completed task -> one flower by priority (LOW poppy, MEDIUM rose, HIGH lotus), the first time the task is
 *      completed, at most 5 task-flowers per local day (stops farming by creating throw-away tasks).
 *
 *  Flower ids are derived from the source (session/task id), so two devices awarding the same reward produce the
 *  same record and sync merges them into one flower.
 */
export const MIN_FOCUS_MINUTES_FOR_FLOWER = 10;
export const MAX_TASK_FLOWERS_PER_DAY = 5;

export function speciesForFocusMinutes(minutes: number): FlowerSpecies | null {
  if (minutes < MIN_FOCUS_MINUTES_FOR_FLOWER) return null;
  if (minutes < 25) return 'daisy';
  if (minutes < 50) return 'tulip';
  return 'sunflower';
}
export const SPECIES_FOR_PRIORITY: Record<Priority, FlowerSpecies> = { LOW: 'poppy', MEDIUM: 'rose', HIGH: 'lotus' };

export interface Award { id: string; data: Flower }

export function awardForSession(sessionId: string, s: Pick<FocusSession, 'completed' | 'actualMinutes' | 'endedAtMs'>, dayKeyOfEnd: string): Award | null {
  if (!s.completed) return null;
  const species = speciesForFocusMinutes(s.actualMinutes);
  if (!species) return null;
  return { id: flowerIdForSession(sessionId), data: { species, source: 'focus', sourceId: sessionId, plantedAtMs: s.endedAtMs, dayKey: dayKeyOfEnd } };
}

export function awardForTask(taskId: string, task: Pick<Task, 'priority'>, nowMs: number, todayKey: string, existing: Array<Pick<Flower, 'source' | 'dayKey' | 'sourceId'>>): Award | null {
  if (existing.some(f => f.source === 'task' && f.sourceId === taskId)) return null;            // only once per task
  const today = existing.filter(f => f.source === 'task' && f.dayKey === todayKey).length;
  if (today >= MAX_TASK_FLOWERS_PER_DAY) return null;
  return { id: flowerIdForTask(taskId), data: { species: SPECIES_FOR_PRIORITY[task.priority], source: 'task', sourceId: taskId, plantedAtMs: nowMs, dayKey: todayKey } };
}

export interface GardenSummary { total: number; bySpecies: Partial<Record<FlowerSpecies, number>>; fromFocus: number; fromTasks: number }
export function summarize(flowers: Array<Pick<Flower, 'species' | 'source'>>): GardenSummary {
  const bySpecies: GardenSummary['bySpecies'] = {};
  let fromFocus = 0, fromTasks = 0;
  for (const f of flowers) {
    bySpecies[f.species] = (bySpecies[f.species] ?? 0) + 1;
    if (f.source === 'focus') fromFocus++; else fromTasks++;
  }
  return { total: flowers.length, bySpecies, fromFocus, fromTasks };
}

/** Stable plot order: oldest flower first; ties broken by id so every device lays out the garden identically. */
export function layout<T extends SyncRecord<Flower>>(flowers: T[]): T[] {
  return [...flowers].sort((a, b) => a.plantedAtMs - b.plantedAtMs || (a.id < b.id ? -1 : 1));
}
