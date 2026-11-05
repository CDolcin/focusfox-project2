import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, LocalDb, MemoryKV, OfflineQueue, backoffMs } from '../src/core/sync';
import { FakeClock } from './helpers';

const rec = (id: string, hlc: string) => ({ id, hlc, deleted: false, updatedBy: 'd', title: id });

describe('OfflineQueue', () => {
  it('keeps FIFO order across different records', async () => {
    const q = new OfflineQueue(new LocalDb(new MemoryKV(), 'u'), new FakeClock());
    await q.enqueue('tasks', rec('a', '1')); await q.enqueue('notes', rec('b', '2')); await q.enqueue('tasks', rec('c', '3'));
    expect((await q.ready(0)).map(o => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('coalesces repeated writes to one record and keeps its place in line', async () => {
    const q = new OfflineQueue(new LocalDb(new MemoryKV(), 'u'), new FakeClock());
    await q.enqueue('tasks', rec('a', '1')); await q.enqueue('tasks', rec('b', '2')); await q.enqueue('tasks', rec('a', '3'));
    const ops = await q.ready(0);
    expect(ops.map(o => o.id)).toEqual(['a', 'b']);
    expect(ops[0].record.hlc).toBe('3');
    expect(await q.pendingCount()).toBe(2);
  });

  it('survives an app restart (new queue instance over the same storage)', async () => {
    const kv = new MemoryKV();
    await new OfflineQueue(new LocalDb(kv, 'u')).enqueue('tasks', rec('a', '1'));
    const reopened = new OfflineQueue(new LocalDb(kv, 'u'));
    expect((await reopened.ready(0)).map(o => o.id)).toEqual(['a']);
  });

  it('is isolated per user scope', async () => {
    const kv = new MemoryKV();
    await new OfflineQueue(new LocalDb(kv, 'alice')).enqueue('tasks', rec('a', '1'));
    expect(await new OfflineQueue(new LocalDb(kv, 'bob')).pendingCount()).toBe(0);
  });

  it('backs off exponentially, capped, and hides ops until their retry time', async () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(BACKOFF_BASE_MS);
    expect(backoffMs(3)).toBe(BACKOFF_BASE_MS * 4);
    expect(backoffMs(50)).toBe(BACKOFF_MAX_MS);
    const clock = new FakeClock(10_000);
    const q = new OfflineQueue(new LocalDb(new MemoryKV(), 'u'), clock);
    const op = await q.enqueue('tasks', rec('a', '1'));
    await q.markFailure(op.seq, 'offline', clock.now());
    expect(await q.ready(clock.now())).toHaveLength(0);
    expect(await q.ready(clock.now() + BACKOFF_BASE_MS)).toHaveLength(1);
  });

  it('parks permanent failures as dead and can retry them', async () => {
    const q = new OfflineQueue(new LocalDb(new MemoryKV(), 'u'), new FakeClock());
    const op = await q.enqueue('tasks', rec('a', '1'));
    await q.markFailure(op.seq, 'permission denied', 0, { permanent: true });
    expect(await q.pendingCount()).toBe(0);
    expect(await q.deadOps()).toHaveLength(1);
    expect(await q.retryDead()).toBe(1);
    expect(await q.pendingCount()).toBe(1);
  });

  it('markSuccess does not discard a newer edit made while the older push was in flight', async () => {
    const q = new OfflineQueue(new LocalDb(new MemoryKV(), 'u'), new FakeClock());
    const op = await q.enqueue('tasks', rec('a', '1'));
    await q.enqueue('tasks', rec('a', '2'));          // edited again during the push of hlc '1'
    await q.markSuccess(op.seq, '1');
    const left = await q.ready(0);
    expect(left).toHaveLength(1);
    expect(left[0].record.hlc).toBe('2');
    await q.markSuccess(op.seq, '2');
    expect(await q.pendingCount()).toBe(0);
  });

  it('dropSuperseded removes queued writes older than a winning server version only', async () => {
    const q = new OfflineQueue(new LocalDb(new MemoryKV(), 'u'), new FakeClock());
    await q.enqueue('tasks', rec('a', '5'));
    await q.dropSuperseded('tasks', 'a', '3');
    expect(await q.pendingCount()).toBe(1);
    await q.dropSuperseded('tasks', 'a', '9');
    expect(await q.pendingCount()).toBe(0);
  });
});
