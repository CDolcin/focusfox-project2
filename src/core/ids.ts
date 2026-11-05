/** Id helpers. RNG and clock are injectable so tests are deterministic. */
export type Rng = () => number;

export function createId(prefix: string, nowMs: number = Date.now(), rng: Rng = Math.random): string {
  const t = nowMs.toString(36);
  let r = '';
  for (let i = 0; i < 8; i++) r += Math.floor(rng() * 36).toString(36);
  return `${prefix}_${t}${r}`;
}

/** Deterministic ids so that re-awarding the same reward on two devices cannot create duplicates. */
export const flowerIdForSession = (sessionId: string) => `fl_focus_${sessionId}`;
export const flowerIdForTask = (taskId: string) => `fl_task_${taskId}`;
