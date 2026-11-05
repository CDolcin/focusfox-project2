import { HybridClock, compareHlc, formatHlc, parseHlc, resolve } from '../src/core/sync';
import { FakeClock } from './helpers';

describe('HybridClock', () => {
  it('round-trips stamps and orders them as strings', () => {
    const s = formatHlc(1700000000000, 255, 'devA');
    expect(parseHlc(s)).toEqual({ wall: 1700000000000, counter: 255, deviceId: 'devA' });
    expect(compareHlc(formatHlc(1, 0, 'a'), formatHlc(2, 0, 'a'))).toBeLessThan(0);
    expect(compareHlc(formatHlc(5, 2, 'a'), formatHlc(5, 10, 'a'))).toBeLessThan(0); // counter compared numerically (fixed-width hex)
    expect(compareHlc(formatHlc(5, 0, 'a'), formatHlc(5, 0, 'b'))).toBeLessThan(0);  // deviceId breaks exact ties
  });

  it('is strictly increasing even when the wall clock stands still or goes backwards', () => {
    const clock = new FakeClock(1000);
    const h = new HybridClock('d1', clock);
    const a = h.next(); const b = h.next();
    clock.t = 500; // clock moved backwards
    const c = h.next();
    expect(compareHlc(a, b)).toBeLessThan(0);
    expect(compareHlc(b, c)).toBeLessThan(0);
  });

  it('observe() makes the next local stamp greater than any stamp seen (skewed clocks)', () => {
    const behind = new HybridClock('slow', new FakeClock(1000));
    const remote = formatHlc(9_000, 3, 'fast');
    behind.observe(remote);
    expect(compareHlc(behind.next(), remote)).toBeGreaterThan(0);
  });

  it('rejects malformed stamps and ids containing the separator', () => {
    expect(() => parseHlc('nope')).toThrow();
    expect(() => formatHlc(1, 0, 'a.b')).toThrow();
  });
});

describe('resolve (last-write-wins by hlc, tombstones are ordinary writes)', () => {
  const rec = (hlc: string, deleted = false) => ({ id: 'x', hlc, deleted, updatedBy: 'd' });
  const t1 = formatHlc(1000, 0, 'a'); const t2 = formatHlc(2000, 0, 'b');

  it('newer stamp wins in either direction', () => {
    expect(resolve(rec(t1), rec(t2))).toBe('remote');
    expect(resolve(rec(t2), rec(t1))).toBe('local');
  });
  it('equal stamps are the same write (idempotent)', () => { expect(resolve(rec(t1), rec(t1))).toBe('same'); });
  it('missing side loses', () => {
    expect(resolve(undefined, rec(t1))).toBe('remote');
    expect(resolve(rec(t1), undefined)).toBe('local');
  });
  it('a delete beats an older edit; a newer edit resurrects a delete', () => {
    expect(resolve(rec(t1), rec(t2, true))).toBe('remote');   // tombstone newer -> deleted
    expect(resolve(rec(t2, true), rec(t1))).toBe('local');    // tombstone newer -> stays deleted
    expect(resolve(rec(t1, true), rec(t2))).toBe('remote');   // edit after delete -> resurrected
  });
});
