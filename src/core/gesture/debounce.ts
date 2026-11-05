import { Chord } from '../models';

export interface PressEvent { type: 'press'; chord: Chord; tMs: number }
export interface ReleaseEvent { type: 'release'; chord: Chord; tMs: number }
export type GestureEvent = PressEvent | ReleaseEvent;

export const GESTURE_CONFIRM_MS = 120;   // a gesture must be seen this long before it counts (Project I value)
export const GESTURE_RELEASE_MS = 450;   // a held chord is only released after the hand has been gone this long

/**
 * Two-way debounce between the recognizer's raw per-frame output and musical events.
 * Feed it one observation per frame: the recognised chord or null (no hand / unrecognised).
 *  - press:   candidate chord seen continuously for CONFIRM ms (edge-triggered: held chords do not retrigger)
 *  - release: nothing recognised for RELEASE ms (short drop-outs between frames do not cut the note)
 * Pure and deterministic, so it is tested with fixed frame sequences.
 */
export class GestureDebouncer {
  private held: Chord | null = null;
  private candidate: { chord: Chord; since: number } | null = null;
  private gapSince: number | null = null;

  constructor(private readonly confirmMs = GESTURE_CONFIRM_MS, private readonly releaseMs = GESTURE_RELEASE_MS) {}

  push(chord: Chord | null, tMs: number): GestureEvent[] {
    const events: GestureEvent[] = [];
    if (chord === null) {
      this.candidate = null;
      if (this.held) {
        if (this.gapSince === null) this.gapSince = tMs;
        if (tMs - this.gapSince >= this.releaseMs) {
          events.push({ type: 'release', chord: this.held, tMs });
          this.held = null;
          this.gapSince = null;
        }
      }
      return events;
    }
    this.gapSince = null;
    if (chord === this.held) { this.candidate = null; return events; }
    if (!this.candidate || this.candidate.chord !== chord) this.candidate = { chord, since: tMs };
    if (tMs - this.candidate.since >= this.confirmMs) {
      if (this.held) events.push({ type: 'release', chord: this.held, tMs });
      this.held = chord;
      this.candidate = null;
      events.push({ type: 'press', chord, tMs });
    }
    return events;
  }

  get currentChord(): Chord | null { return this.held; }
  reset(): void { this.held = null; this.candidate = null; this.gapSince = null; }
}
