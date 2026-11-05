import * as T from '../src/core/focus/timer';
import { awardForSession, awardForTask, layout, speciesForFocusMinutes, summarize, MAX_TASK_FLOWERS_PER_DAY } from '../src/core/focus/garden';
import { currentStreak, dayKey } from '../src/core/focus/streak';
import { dailyMinutes, monthlyMinutes } from '../src/core/focus/analytics';
import { buildNotesHtml, buildTasksHtml, escapeHtml, parseDeckFile, serializeDeck } from '../src/core/export/html';
import { task, note } from './helpers';

describe('focus timer (timestamp-driven)', () => {
  it('runs, pauses, resumes and completes without drifting', () => {
    let s = T.idle('focus', 25);
    s = T.start(s, 0);
    expect(T.remainingMs(s, 10 * 60_000)).toBe(15 * 60_000);
    s = T.pause(s, 10 * 60_000);
    expect(T.remainingMs(s, 50 * 60_000)).toBe(15 * 60_000);      // paused time does not count
    s = T.resume(s, 60 * 60_000);
    s = T.tick(s, 74 * 60_000);
    expect(s.status).toBe('running');
    s = T.tick(s, 75 * 60_000);
    expect(s.status).toBe('completed');
    expect(s.endedAtMs).toBe(75 * 60_000);
  });
  it('completes correctly even if the app was backgrounded past the end', () => {
    const s = T.tick(T.start(T.idle('focus', 25), 1000), 1000 + 3 * 3600_000);
    expect(s.status).toBe('completed');
    expect(s.endedAtMs).toBe(1000 + 25 * 60_000);
  });
  it('abandon keeps only the minutes actually focused and is not "completed"', () => {
    const s = T.abandon(T.start(T.idle('focus', 25), 0), 12 * 60_000 + 30_000);
    const r = T.toSessionResult(s, 'Study', 99);
    expect(r).toMatchObject({ completed: false, actualMinutes: 12, plannedMinutes: 25 });
  });
  it('breaks and idle timers produce no session record; finishesAt supports notification scheduling', () => {
    const b = T.tick(T.start(T.idle('break', 5), 0), 6 * 60_000);
    expect(T.toSessionResult(b, 'x', 0)).toBeNull();
    expect(T.toSessionResult(T.idle('focus', 25), 'x', 0)).toBeNull();
    expect(T.finishesAtMs(T.start(T.idle('focus', 25), 1000), 1000)).toBe(1000 + 25 * 60_000);
  });
});

describe('garden rules', () => {
  it('focus flowers need a COMPLETED session of at least 10 minutes; species by length', () => {
    expect(speciesForFocusMinutes(9)).toBeNull();
    expect(speciesForFocusMinutes(10)).toBe('daisy');
    expect(speciesForFocusMinutes(24)).toBe('daisy');
    expect(speciesForFocusMinutes(25)).toBe('tulip');
    expect(speciesForFocusMinutes(49)).toBe('tulip');
    expect(speciesForFocusMinutes(50)).toBe('sunflower');
  });
  it('abandoned sessions and sub-10-minute sessions grow nothing', () => {
    expect(awardForSession('s1', { completed: false, actualMinutes: 30, endedAtMs: 1 }, '2026-10-01')).toBeNull();
    expect(awardForSession('s1', { completed: true, actualMinutes: 5, endedAtMs: 1 }, '2026-10-01')).toBeNull();
  });
  it('award ids are derived from the source, so duplicates on two devices merge into one flower', () => {
    const a = awardForSession('s1', { completed: true, actualMinutes: 25, endedAtMs: 5 }, '2026-10-01')!;
    const b = awardForSession('s1', { completed: true, actualMinutes: 25, endedAtMs: 5 }, '2026-10-01')!;
    expect(a).toEqual(b); expect(a.id).toBe('fl_focus_s1'); expect(a.data.species).toBe('tulip');
  });
  it('task flowers: species by priority, once per task, capped per day', () => {
    expect(awardForTask('t1', { priority: 'HIGH' }, 1, 'D', [])!.data.species).toBe('lotus');
    expect(awardForTask('t1', { priority: 'LOW' }, 1, 'D', [])!.data.species).toBe('poppy');
    expect(awardForTask('t1', { priority: 'MEDIUM' }, 1, 'D', [{ source: 'task', sourceId: 't1', dayKey: 'D' }])).toBeNull();
    const today = Array.from({ length: MAX_TASK_FLOWERS_PER_DAY }, (_, i) => ({ source: 'task' as const, sourceId: `o${i}`, dayKey: 'D' }));
    expect(awardForTask('new', { priority: 'HIGH' }, 1, 'D', today)).toBeNull();
    expect(awardForTask('new', { priority: 'HIGH' }, 1, 'D2', today)).not.toBeNull();   // new day, cap resets
  });
  it('summarises and lays out flowers identically on every device', () => {
    const f = (id: string, at: number, source: 'focus' | 'task' = 'focus') => ({ id, hlc: '', deleted: false, updatedBy: '', species: 'daisy' as const, source, sourceId: id, plantedAtMs: at, dayKey: 'D' });
    const flowers = [f('b', 5), f('a', 5), f('c', 1, 'task')];
    expect(layout(flowers).map(x => x.id)).toEqual(['c', 'a', 'b']);
    expect(summarize(flowers)).toMatchObject({ total: 3, fromFocus: 2, fromTasks: 1 });
  });
});

describe('streak (Project I rule: consecutive days with a completed focus session)', () => {
  const TZ = 0; const DAY = 86_400_000; const noon = Date.UTC(2026, 9, 10, 12);
  const s = (daysAgo: number, completed = true) => ({ completed, startedAtMs: noon - daysAgo * DAY });
  it('counts back from today through consecutive days', () => { expect(currentStreak([s(0), s(1), s(2), s(4)], noon, TZ)).toBe(3); });
  it('is 0 if today has no completed session (strict, as in Project I)', () => { expect(currentStreak([s(1), s(2)], noon, TZ)).toBe(0); });
  it('optional grace keeps yesterday\'s streak alive', () => { expect(currentStreak([s(1), s(2)], noon, TZ, true)).toBe(2); });
  it('ignores abandoned sessions', () => { expect(currentStreak([s(0, false), s(1)], noon, TZ)).toBe(0); });
  it('uses the user\'s local day, not UTC (Bhutan is UTC+6 => offset -360)', () => {
    const lateNightLocal = Date.UTC(2026, 9, 10, 20, 0);     // 02:00 on Oct 11 in Bhutan
    expect(dayKey(lateNightLocal, -360)).toBe('2026-10-11');
    expect(dayKey(lateNightLocal, 0)).toBe('2026-10-10');
  });
});

describe('analytics and export helpers', () => {
  it('daily and monthly totals only count completed sessions', () => {
    const now = Date.UTC(2026, 9, 10, 12);
    const ss = [
      { completed: true, actualMinutes: 25, startedAtMs: now }, { completed: false, actualMinutes: 10, startedAtMs: now },
      { completed: true, actualMinutes: 30, startedAtMs: now - 86_400_000 }, { completed: true, actualMinutes: 40, startedAtMs: Date.UTC(2026, 8, 20) },
    ];
    expect(dailyMinutes(ss, now, 0, 3).map(d => d.minutes)).toEqual([0, 30, 25]);
    expect(monthlyMinutes(ss, 0)).toEqual([{ month: '2026-09', minutes: 40 }, { month: '2026-10', minutes: 55 }]);
  });
  it('escapes user text in PDF HTML', () => {
    expect(escapeHtml('<script>"x"&\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;&lt;/script&gt;');
    expect(buildNotesHtml([{ ...note(), title: '<b>t</b>', content: 'a\nb' }], 'now')).not.toContain('<b>t</b>');
    expect(buildTasksHtml([task({ title: 'Do <it>' })], 'now', () => 'Oct 10')).toContain('Do &lt;it&gt;');
  });
  it('deck files round-trip and invalid files are rejected', () => {
    const text = serializeDeck({ name: 'CPL' }, [{ question: 'q', answer: 'a', mastered: true }], 5);
    expect(parseDeckFile(text)).toMatchObject({ name: 'CPL', cards: [{ question: 'q', answer: 'a', mastered: true }] });
    expect(() => parseDeckFile('{"hello":1}')).toThrow(/Not a FocusFox deck file/);
    expect(() => parseDeckFile('not json')).toThrow();
    expect(() => parseDeckFile(JSON.stringify({ app: 'focusfox', version: 99, name: 'x', cards: [] }))).toThrow(/newer/);
  });
});
