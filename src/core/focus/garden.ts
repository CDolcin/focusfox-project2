import {
  Flower,
  FlowerSpecies,
  FocusSession,
  Priority,
  SyncRecord,
  Task,
} from '../models';
import {
  flowerIdForSession,
  flowerIdForTask,
} from '../ids';

/**
 * Garden rules:
 *
 * Completed focus sessions:
 *   1–24 minutes  → Daisy
 *   25–49 minutes → Tulip
 *   50+ minutes   → Sunflower
 *
 * Stopped or incomplete sessions grow nothing.
 *
 * Existing task rewards:
 *   LOW    → Poppy
 *   MEDIUM → Rose
 *   HIGH   → Lotus
 *
 * Each task earns a flower once, up to five task flowers per day.
 */
export const MIN_FOCUS_MINUTES_FOR_FLOWER = 1;
export const MAX_TASK_FLOWERS_PER_DAY = 5;

export function speciesForFocusMinutes(
  minutes: number
): FlowerSpecies | null {
  if (
    !Number.isFinite(minutes) ||
    minutes < MIN_FOCUS_MINUTES_FOR_FLOWER
  ) {
    return null;
  }

  if (minutes < 25) return 'daisy';
  if (minutes < 50) return 'tulip';

  return 'sunflower';
}

export const SPECIES_FOR_PRIORITY: Record<
  Priority,
  FlowerSpecies
> = {
  LOW: 'poppy',
  MEDIUM: 'rose',
  HIGH: 'lotus',
};

export interface Award {
  id: string;
  data: Flower;
}

/**
 * Award one flower for a completed focus session.
 * The flower ID is derived from the session ID.
 */
export function awardForSession(
  sessionId: string,
  session: Pick<
    FocusSession,
    'completed' | 'actualMinutes' | 'endedAtMs'
  >,
  dayKeyOfEnd: string
): Award | null {
  if (!session.completed) return null;

  const species = speciesForFocusMinutes(
    session.actualMinutes
  );

  if (!species) return null;

  return {
    id: flowerIdForSession(sessionId),
    data: {
      species,
      source: 'focus',
      sourceId: sessionId,
      plantedAtMs: session.endedAtMs,
      dayKey: dayKeyOfEnd,
    },
  };
}

/**
 * Preserve the existing task flower rewards and daily limit.
 */
export function awardForTask(
  taskId: string,
  task: Pick<Task, 'priority'>,
  nowMs: number,
  todayKey: string,
  existing: Array<
    Pick<Flower, 'source' | 'dayKey' | 'sourceId'>
  >
): Award | null {
  const alreadyAwarded = existing.some(
    flower =>
      flower.source === 'task' &&
      flower.sourceId === taskId
  );

  if (alreadyAwarded) return null;

  const todayCount = existing.filter(
    flower =>
      flower.source === 'task' &&
      flower.dayKey === todayKey
  ).length;

  if (todayCount >= MAX_TASK_FLOWERS_PER_DAY) {
    return null;
  }

  return {
    id: flowerIdForTask(taskId),
    data: {
      species: SPECIES_FOR_PRIORITY[task.priority],
      source: 'task',
      sourceId: taskId,
      plantedAtMs: nowMs,
      dayKey: todayKey,
    },
  };
}

export interface GardenSummary {
  total: number;
  bySpecies: Partial<Record<FlowerSpecies, number>>;
  fromFocus: number;
  fromTasks: number;
}

export function summarize(
  flowers: Array<Pick<Flower, 'species' | 'source'>>
): GardenSummary {
  const bySpecies: GardenSummary['bySpecies'] = {};

  let fromFocus = 0;
  let fromTasks = 0;

  for (const flower of flowers) {
    bySpecies[flower.species] =
      (bySpecies[flower.species] ?? 0) + 1;

    if (flower.source === 'focus') {
      fromFocus += 1;
    } else {
      fromTasks += 1;
    }
  }

  return {
    total: flowers.length,
    bySpecies,
    fromFocus,
    fromTasks,
  };
}

/**
 * Oldest flowers first, with ID as a stable tie-breaker.
 */
export function layout<T extends SyncRecord<Flower>>(
  flowers: T[]
): T[] {
  return [...flowers].sort((a, b) => {
    const timeDifference =
      a.plantedAtMs - b.plantedAtMs;

    if (timeDifference !== 0) return timeDifference;

    if (a.id === b.id) return 0;

    return a.id < b.id ? -1 : 1;
  });
}