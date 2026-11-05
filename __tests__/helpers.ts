import { LocalDb, MemoryKV, SyncEngine, InMemoryRemote, Clock } from '../src/core/sync';
import { Task, Note } from '../src/core/models';

export class FakeClock implements Clock {
  constructor(public t = 1_700_000_000_000) {}
  now() { return this.t; }
  advance(ms: number) { this.t += ms; return this.t; }
}

export async function makeDevice(remote: InMemoryRemote | null, deviceId: string, clock: FakeClock, scope = 'user1', pageSize?: number) {
  const kv = new MemoryKV();
  const db = new LocalDb(kv, scope);
  const engine = await SyncEngine.create({ db, remote, deviceId, clock, pageSize });
  return { engine, db, kv, clock };
}

export const task = (over: Partial<Task> = {}): Task => ({
  title: 'Read chapter 4', description: '', priority: 'MEDIUM', deadlineMs: 1_700_100_000_000, reminderMinutesBefore: 15,
  completed: false, completedAtMs: null, createdAtMs: 1_700_000_000_000, imageUris: [], imagePaths: [], ...over,
});
export const note = (over: Partial<Note> = {}): Note => ({ title: 'N', content: 'body', colorTag: 0, createdAtMs: 1_700_000_000_000, ...over });

/** Small seeded PRNG so "random" tests are reproducible. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
