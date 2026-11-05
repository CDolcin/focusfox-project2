/**
 * Hybrid Logical Clock (HLC).
 *
 * Why not raw wall-clock timestamps? Phones have skewed clocks and edits happen offline, so two devices can
 * produce "the same millisecond" or an earlier time for a later edit. An HLC keeps the wall time (so stamps
 * stay meaningful) but never goes backwards and always advances past any stamp it has seen, which gives a
 * total, deterministic order. The string form is fixed-width so plain string comparison IS the ordering.
 *
 *   <wall ms, 15 digits>.<counter, 4 hex>.<deviceId>
 *
 * The deviceId at the end is the final tie-breaker, so two devices can never produce equal stamps.
 */
export interface Clock { now(): number }
export const systemClock: Clock = { now: () => Date.now() };

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 4;
const MAX_COUNTER = 0xffff;

export interface ParsedHlc { wall: number; counter: number; deviceId: string }

export function formatHlc(wall: number, counter: number, deviceId: string): string {
  if (deviceId.includes('.')) throw new Error('deviceId must not contain "."');
  return `${String(wall).padStart(WALL_DIGITS, '0')}.${counter.toString(16).padStart(COUNTER_DIGITS, '0')}.${deviceId}`;
}

export function parseHlc(stamp: string): ParsedHlc {
  const a = stamp.indexOf('.');
  const b = stamp.indexOf('.', a + 1);
  if (a !== WALL_DIGITS || b !== a + 1 + COUNTER_DIGITS) throw new Error(`Invalid HLC stamp: ${stamp}`);
  return { wall: Number(stamp.slice(0, a)), counter: parseInt(stamp.slice(a + 1, b), 16), deviceId: stamp.slice(b + 1) };
}

/** Total order. Positive if a is newer than b. */
export function compareHlc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class HybridClock {
  private wall = 0;
  private counter = 0;

  constructor(private readonly deviceId: string, private readonly clock: Clock = systemClock, lastStamp?: string) {
    if (lastStamp) {
      const p = parseHlc(lastStamp);
      this.wall = p.wall;
      this.counter = p.counter;
    }
  }

  /** Stamp for a local event (a write made on this device). Strictly greater than every stamp seen so far. */
  next(): string {
    const physical = this.clock.now();
    if (physical > this.wall) {
      this.wall = physical;
      this.counter = 0;
    } else if (this.counter >= MAX_COUNTER) {
      this.wall += 1;
      this.counter = 0;
    } else {
      this.counter += 1;
    }
    return formatHlc(this.wall, this.counter, this.deviceId);
  }

  /** Merge a stamp received from the server or another device so our next stamp is greater than it. */
  observe(remoteStamp: string): void {
    const r = parseHlc(remoteStamp);
    if (r.wall > this.wall) {
      this.wall = r.wall;
      this.counter = r.counter;
    } else if (r.wall === this.wall && r.counter > this.counter) {
      this.counter = r.counter;
    }
  }

  last(): string {
    return formatHlc(this.wall, this.counter, this.deviceId);
  }
}
