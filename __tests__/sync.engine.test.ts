import { InMemoryRemote, RemoteError, BACKOFF_BASE_MS, SyncEngine, LocalDb } from '../src/core/sync';
import { FakeClock, makeDevice, note, seeded, task } from './helpers';

describe('SyncEngine: offline-first writes', () => {
  it('writes are instant and local, queue while offline, and flush on reconnect', async () => {
    const remote = new InMemoryRemote(); remote.online = false;
    const clock = new FakeClock();
    const a = await makeDevice(remote, 'A', clock);

    await a.engine.upsert('tasks', 't1', task({ title: 'Offline task' }));
    expect((await a.engine.list('tasks')).map(t => t.title)).toEqual(['Offline task']);
    expect(await a.engine.pendingCount()).toBe(1);

    const failed = await a.engine.flush();
    expect(failed.stoppedOffline).toBe(true);
    expect(remote.peek('tasks', 't1')).toBeUndefined();

    remote.online = true;
    clock.advance(BACKOFF_BASE_MS);
    const ok = await a.engine.flush();
    expect(ok.pushed).toBe(1);
    expect(await a.engine.pendingCount()).toBe(0);
    expect(remote.peek('tasks', 't1')?.title).toBe('Offline task');
  });

  it('does not hammer the server while backing off', async () => {
    const remote = new InMemoryRemote(); remote.online = false;
    const clock = new FakeClock();
    const a = await makeDevice(remote, 'A', clock);
    await a.engine.upsert('notes', 'n1', note());
    await a.engine.flush(); await a.engine.flush(); await a.engine.flush();
    remote.online = true;
    expect((await a.engine.flush()).pushed).toBe(0);      // still inside the backoff window
    clock.advance(BACKOFF_BASE_MS);
    expect((await a.engine.flush()).pushed).toBe(1);
  });

  it('coalesces many offline edits into one push carrying the latest content', async () => {
    const remote = new InMemoryRemote();
    const a = await makeDevice(remote, 'A', new FakeClock());
    await a.engine.upsert('notes', 'n1', note({ content: 'v1' }));
    await a.engine.patch('notes', 'n1', { content: 'v2' });
    await a.engine.patch('notes', 'n1', { content: 'v3' });
    await a.engine.sync();
    expect(remote.pushCount).toBe(1);
    expect(remote.peek('notes', 'n1')?.content).toBe('v3');
  });

  it('local-only mode (no remote) keeps working and just accumulates the queue', async () => {
    const a = await makeDevice(null, 'A', new FakeClock());
    await a.engine.upsert('tasks', 't1', task());
    const s = await a.engine.sync();
    expect(s).toMatchObject({ pushed: 0, pulled: 0 });
    expect(await a.engine.pendingCount()).toBe(1);
  });

  it('queued writes survive an app restart', async () => {
    const remote = new InMemoryRemote(); remote.online = false;
    const clock = new FakeClock();
    const a = await makeDevice(remote, 'A', clock);
    await a.engine.upsert('tasks', 't1', task({ title: 'Survives' }));
    // "restart": new engine over the same storage
    const reopened = await SyncEngine.create({ db: new LocalDb(a.kv, 'user1'), remote, deviceId: 'A', clock });
    expect(await reopened.pendingCount()).toBe(1);
    remote.online = true;
    expect((await reopened.sync()).pushed).toBe(1);
  });
});

describe('SyncEngine: new phone restore', () => {
  it('a fresh device pulls everything the first device uploaded, including pages of data', async () => {
    const remote = new InMemoryRemote();
    const a = await makeDevice(remote, 'A', new FakeClock());
    for (let i = 0; i < 5; i++) await a.engine.upsert('cards', `c${i}`, { deckId: 'd1', question: `q${i}`, answer: 'a', mastered: false, origin: null });
    await a.engine.upsert('flowers', 'fl1', { species: 'daisy', source: 'focus', sourceId: 's1', plantedAtMs: 1, dayKey: '2026-10-01' });
    await a.engine.sync();

    const b = await makeDevice(remote, 'B', new FakeClock(), 'user1', 2); // page size 2 forces pagination
    const s = await b.engine.sync();
    expect(s.pulled).toBe(6);
    expect((await b.engine.list('cards'))).toHaveLength(5);
    expect((await b.engine.list('flowers'))).toHaveLength(1);
  });

  it('re-delivery of the same records is idempotent', async () => {
    const remote = new InMemoryRemote();
    const a = await makeDevice(remote, 'A', new FakeClock());
    await a.engine.upsert('notes', 'n1', note());
    await a.engine.sync();
    const b = await makeDevice(remote, 'B', new FakeClock());
    await b.engine.sync();
    const page = await remote.pull('notes', null, 50);
    expect(await b.engine.ingest('notes', page.records)).toBe(0);
  });
});

describe('SyncEngine: conflict resolution (per-record last-write-wins by hlc)', () => {
  it('after seeing the other device, a later edit wins even if this phone clock is behind', async () => {
    const remote = new InMemoryRemote();
    const a = await makeDevice(remote, 'A', new FakeClock(2_000_000));
    const b = await makeDevice(remote, 'B', new FakeClock(1_000_000)); // B's clock is 1000 s behind
    await a.engine.upsert('notes', 'n', note({ content: 'from A' }));
    await a.engine.sync();
    await b.engine.sync();                                  // B observes A's stamp
    await b.engine.patch('notes', 'n', { content: 'from B' });
    await b.engine.sync(); await a.engine.sync();
    expect((await a.engine.get('notes', 'n'))?.content).toBe('from B');
    expect((await b.engine.get('notes', 'n'))?.content).toBe('from B');
  });

  it('concurrent offline edits: the greater stamp wins on both devices (deterministic)', async () => {
    const remote = new InMemoryRemote();
    const ca = new FakeClock(1_000); const cb = new FakeClock(1_000);
    const a = await makeDevice(remote, 'A', ca); const b = await makeDevice(remote, 'B', cb);
    await a.engine.upsert('tasks', 't', task({ title: 'base' })); await a.engine.sync(); await b.engine.sync();
    remote.online = false;
    ca.advance(10); await a.engine.patch('tasks', 't', { title: 'A edit' });
    cb.advance(20); await b.engine.patch('tasks', 't', { title: 'B edit (later)' });
    remote.online = true;
    for (let i = 0; i < 2; i++) { ca.advance(10_000); cb.advance(10_000); await a.engine.sync(); await b.engine.sync(); }
    expect((await a.engine.get('tasks', 't'))?.title).toBe('B edit (later)');
    expect((await b.engine.get('tasks', 't'))?.title).toBe('B edit (later)');
  });

  it('a delete on one device removes the record everywhere; a later edit resurrects it', async () => {
    const remote = new InMemoryRemote();
    const ca = new FakeClock(1_000); const cb = new FakeClock(1_000);
    const a = await makeDevice(remote, 'A', ca); const b = await makeDevice(remote, 'B', cb);
    await a.engine.upsert('notes', 'n', note()); await a.engine.sync(); await b.engine.sync();

    await a.engine.remove('notes', 'n'); ca.advance(5);
    await a.engine.sync(); await b.engine.sync();
    expect(await b.engine.get('notes', 'n')).toBeUndefined();

    cb.advance(5000);
    await b.engine.upsert('notes', 'n', note({ title: 'back' })); // newer than the tombstone
    await b.engine.sync(); await a.engine.sync();
    expect((await a.engine.get('notes', 'n'))?.title).toBe('back');
  });

  it('an old offline edit loses to a newer delete after reconnecting', async () => {
    const remote = new InMemoryRemote();
    const ca = new FakeClock(1_000); const cb = new FakeClock(1_000);
    const a = await makeDevice(remote, 'A', ca); const b = await makeDevice(remote, 'B', cb);
    await a.engine.upsert('notes', 'n', note()); await a.engine.sync(); await b.engine.sync();
    remote.online = false;
    cb.advance(10); await b.engine.patch('notes', 'n', { content: 'edited offline' });
    remote.online = true;
    ca.advance(100); await a.engine.remove('notes', 'n'); await a.engine.sync();
    cb.advance(10_000); await b.engine.sync();
    expect(await b.engine.get('notes', 'n')).toBeUndefined();
  });

  it('three devices applying random operations in random sync order converge to identical state', async () => {
    const rng = seeded(42);
    const remote = new InMemoryRemote();
    const clocks = [new FakeClock(1_000), new FakeClock(5_000), new FakeClock(300)];  // skewed
    const devs = await Promise.all(clocks.map((c, i) => makeDevice(remote, `D${i}`, c)));
    const ids = ['t1', 't2', 't3', 't4'];
    for (let step = 0; step < 120; step++) {
      const i = Math.floor(rng() * 3); const d = devs[i]; clocks[i].advance(1 + Math.floor(rng() * 50));
      const id = ids[Math.floor(rng() * ids.length)]; const r = rng();
      if (r < 0.5) await d.engine.upsert('tasks', id, task({ title: `${id}@${step}` }));
      else if (r < 0.65) await d.engine.remove('tasks', id);
      else if (r < 0.8) remote.online = rng() < 0.5;
      else if (remote.online) await d.engine.sync(clocks[i].advance(60_000));
    }
    remote.online = true;
    for (let round = 0; round < 3; round++) for (let i = 0; i < 3; i++) await devs[i].engine.sync(clocks[i].advance(120_000));
    const snap = async (d: (typeof devs)[number]) => JSON.stringify((await d.engine.list('tasks')).map(t => [t.id, t.title, t.hlc]).sort());
    const [s0, s1, s2] = [await snap(devs[0]), await snap(devs[1]), await snap(devs[2])];
    expect(s1).toBe(s0); expect(s2).toBe(s0);
    expect(await devs[0].engine.pendingCount()).toBe(0);
  });

  it('an edit made while a push is in flight is not lost', async () => {
    const remote = new InMemoryRemote();
    const a = await makeDevice(remote, 'A', new FakeClock());
    await a.engine.upsert('notes', 'n', note({ content: 'v1' }));
    let edited = false;
    remote.beforePushResolves = async () => { if (!edited) { edited = true; await a.engine.patch('notes', 'n', { content: 'v2' }); } };
    await a.engine.flush();
    expect(await a.engine.pendingCount()).toBe(1);          // v2 still queued
    await a.engine.flush();
    expect(remote.peek('notes', 'n')?.content).toBe('v2');
    expect(await a.engine.pendingCount()).toBe(0);
  });

  it('a stale push is answered with the server version, which replaces the local one', async () => {
    const remote = new InMemoryRemote();
    const ca = new FakeClock(10_000); const cb = new FakeClock(1_000);
    const a = await makeDevice(remote, 'A', ca); const b = await makeDevice(remote, 'B', cb);
    await a.engine.upsert('notes', 'n', note({ content: 'newer' })); await a.engine.sync();
    await b.engine.upsert('notes', 'n', note({ content: 'older' }));   // B never saw A; its stamp is older
    const res = await b.engine.flush();
    expect(res.stale).toBe(1);
    expect((await b.engine.get('notes', 'n'))?.content).toBe('newer');
    expect(await b.engine.pendingCount()).toBe(0);
  });
});

describe('SyncEngine: failures and real-time', () => {
  it('permission errors are parked as dead ops, not retried forever, and can be retried on demand', async () => {
    const remote = new InMemoryRemote();
    const a = await makeDevice(remote, 'A', new FakeClock());
    await a.engine.upsert('tasks', 't', task());
    remote.failNext = new RemoteError('permission', 'denied');
    const r = await a.engine.flush();
    expect(r.failed).toBe(1);
    expect(await a.engine.pendingCount()).toBe(0);
    expect(await a.engine.deadOps()).toHaveLength(1);
    expect(await a.engine.retryDead()).toBe(1);
    expect((await a.engine.flush()).pushed).toBe(1);
  });

  it('real-time listener applies another device\'s write without a manual pull', async () => {
    const remote = new InMemoryRemote();
    const a = await makeDevice(remote, 'A', new FakeClock());
    const b = await makeDevice(remote, 'B', new FakeClock());
    await b.engine.startRealtime();
    const seen = new Promise<void>(res => b.engine.onChange('notes', () => res()));
    await a.engine.upsert('notes', 'n', note({ title: 'live' }));
    await a.engine.flush();
    await seen;
    expect((await b.engine.get('notes', 'n'))?.title).toBe('live');
    b.engine.stopRealtime();
  });

  it('two accounts on one phone never see each other\'s data', async () => {
    const remote = new InMemoryRemote();
    const clock = new FakeClock();
    const alice = await makeDevice(remote, 'P', clock, 'alice');
    await alice.engine.upsert('notes', 'n', note());
    const bob = await SyncEngine.create({ db: new LocalDb(alice.kv, 'bob'), remote: null, deviceId: 'P', clock });
    expect(await bob.list('notes')).toHaveLength(0);
  });
});
