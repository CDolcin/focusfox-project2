import { GestureDebouncer } from '../src/core/gesture/debounce';
import { chordForGesture } from '../src/core/gesture/mapping';
import { buildSequence, scorePractice, updateBestScore, Press, DEFAULT_WINDOW_MS } from '../src/core/gesture/scoring';
import { ChordRecorder, chordSequence, schedulePlayback } from '../src/core/gesture/recording';
import { Chord } from '../src/core/models';

const SEQ: Chord[] = ['C', 'G', 'Am', 'F', 'D', 'Em'];

describe('gesture mapping', () => {
  it('maps the six MediaPipe labels to chords and ignores low-confidence or unknown labels', () => {
    expect(['Pointing_Up', 'Victory', 'ILoveYou', 'Open_Palm', 'Thumb_Up', 'Closed_Fist'].map(l => chordForGesture(l))).toEqual(SEQ);
    expect(chordForGesture('Thumb_Down')).toBeNull();
    expect(chordForGesture('Victory', 0.2)).toBeNull();
    expect(chordForGesture(null)).toBeNull();
  });
});

describe('GestureDebouncer (confirm 120 ms, release 450 ms)', () => {
  const run = (frames: Array<[Chord | null, number]>) => { const d = new GestureDebouncer(); return frames.flatMap(([c, t]) => d.push(c, t)); };

  it('needs the gesture to persist for 120 ms before pressing', () => {
    expect(run([['C', 0], ['C', 60]])).toEqual([]);
    expect(run([['C', 0], ['C', 60], ['C', 120]])).toEqual([{ type: 'press', chord: 'C', tMs: 120 }]);
  });
  it('is edge-triggered: a held chord does not retrigger', () => {
    const ev = run([['C', 0], ['C', 120], ['C', 200], ['C', 400], ['C', 800]]);
    expect(ev.filter(e => e.type === 'press')).toHaveLength(1);
  });
  it('a flicker shorter than the confirm time never fires', () => {
    expect(run([['C', 0], ['G', 50], ['C', 100], ['G', 150]])).toEqual([]);
  });
  it('short drop-outs (< 450 ms) do not release the held chord', () => {
    const ev = run([['C', 0], ['C', 120], [null, 200], [null, 500], ['C', 600]]);
    expect(ev.filter(e => e.type === 'release')).toHaveLength(0);
  });
  it('releases after 450 ms without a hand, and can then press again', () => {
    const ev = run([['C', 0], ['C', 120], [null, 200], [null, 650], ['C', 700], ['C', 820]]);
    expect(ev.map(e => e.type)).toEqual(['press', 'release', 'press']);
  });
  it('switching chords releases the old one and presses the new one together', () => {
    const ev = run([['C', 0], ['C', 120], ['G', 200], ['G', 330]]);
    expect(ev.map(e => `${e.type}:${e.chord}`)).toEqual(['press:C', 'release:C', 'press:G']);
  });
});

describe('practice scoring (0-100), independent of camera', () => {
  const targets = buildSequence(SEQ);
  const perfect: Press[] = targets.map(t => ({ chord: t.chord, tMs: t.startMs + 300 }));

  it('a perfect, quick run scores 100', () => {
    const r = scorePractice(targets, perfect);
    expect(r.score).toBe(100);
    expect(r.perTarget.every(t => t.hit)).toBe(true);
  });
  it('no gestures scores 0', () => {
    const r = scorePractice(targets, []);
    expect(r.score).toBe(0);
    expect(r.perTarget.every(t => !t.hit)).toBe(true);
  });
  it('correct but slow still earns accuracy points and less timing credit', () => {
    const slow = targets.map(t => ({ chord: t.chord, tMs: t.startMs + DEFAULT_WINDOW_MS - 1 }));
    const r = scorePractice(targets, slow);
    expect(r.accuracy).toBe(1);
    expect(r.timing).toBeLessThan(0.01);
    expect(r.score).toBe(70);
  });
  it('timing credit is full inside the 1 s grace period and falls linearly after it', () => {
    const t = [{ chord: 'C' as Chord, startMs: 0, windowMs: 4000 }];
    expect(scorePractice(t, [{ chord: 'C', tMs: 1000 }]).timing).toBe(1);
    expect(scorePractice(t, [{ chord: 'C', tMs: 2500 }]).timing).toBeCloseTo(0.5, 5);
  });
  it('half the chords right and quick gives 50', () => {
    const r = scorePractice(targets, perfect.slice(0, 3));
    expect(r.score).toBe(50);
  });
  it('wrong chords shown before the right one cost accuracy (0.25 each, floored at 0)', () => {
    const t = [{ chord: 'C' as Chord, startMs: 0, windowMs: 4000 }];
    const one = scorePractice(t, [{ chord: 'G', tMs: 100 }, { chord: 'C', tMs: 500 }]);
    expect(one.perTarget[0]).toMatchObject({ hit: true, wrongPresses: 1, accuracyCredit: 0.75 });
    const many = scorePractice(t, [1, 2, 3, 4, 5].map(i => ({ chord: 'G' as Chord, tMs: i * 10 })).concat({ chord: 'C' as Chord, tMs: 900 } as never));
    expect(many.perTarget[0].accuracyCredit).toBe(0);
  });
  it('presses outside a target window are ignored for that target', () => {
    const t = [{ chord: 'C' as Chord, startMs: 1000, windowMs: 2000 }];
    expect(scorePractice(t, [{ chord: 'C', tMs: 999 }, { chord: 'C', tMs: 3000 }]).score).toBe(0);
  });
  it('is deterministic for the same input regardless of press order', () => {
    const shuffled = [...perfect].reverse();
    expect(scorePractice(targets, shuffled)).toEqual(scorePractice(targets, perfect));
  });
  it('tracks best score per instrument and never lowers it', () => {
    const b1 = updateBestScore({}, 'Guitar', 80);
    expect(updateBestScore(b1, 'Guitar', 60)).toBe(b1);
    expect(updateBestScore(b1, 'Guitar', 91)).toEqual({ Guitar: 91 });
    expect(updateBestScore(b1, 'Piano', 10)).toEqual({ Guitar: 80, Piano: 10 });
  });
});

describe('recording', () => {
  it('records chord events relative to the start and builds a Project I style sequence string', () => {
    const r = new ChordRecorder(); r.start(10_000);
    r.press('C', 10_500); r.press('G', 12_000);
    const out = r.stop(14_000);
    expect(out).toEqual({ durationMs: 4000, events: [{ chord: 'C', tMs: 500 }, { chord: 'G', tMs: 2000 }] });
    expect(chordSequence(out.events)).toBe('C,G');
    r.press('Am', 15_000);
    expect(r.stop(16_000).events).toEqual([]);   // presses outside a take are ignored
  });
  it('replays chords at their saved times and can be cancelled', () => {
    const queue: Array<{ fn: () => void; at: number; cancelled: boolean }> = [];
    const schedule = (fn: () => void, at: number) => { const e = { fn, at, cancelled: false }; queue.push(e); return () => { e.cancelled = true; }; };
    const played: Chord[] = [];
    const cancel = schedulePlayback([{ chord: 'C', tMs: 500 }, { chord: 'G', tMs: 2000 }], c => played.push(c), schedule);
    expect(queue.map(q => q.at)).toEqual([500, 2000]);
    queue[0].fn(); cancel();
    expect(queue.every(q => q.cancelled)).toBe(true);
    expect(played).toEqual(['C']);
  });
});
