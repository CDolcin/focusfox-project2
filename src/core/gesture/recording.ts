import { Chord, ChordEvent } from '../models';

/** Captures chord presses with timestamps relative to the start of the take. */
export class ChordRecorder {
  private startMs: number | null = null;
  private events: ChordEvent[] = [];

  start(nowMs: number): void { this.startMs = nowMs; this.events = []; }
  get isRecording(): boolean { return this.startMs !== null; }
  press(chord: Chord, nowMs: number): void {
    if (this.startMs === null) return;
    this.events.push({ chord, tMs: Math.max(0, nowMs - this.startMs) });
  }
  stop(nowMs: number): { durationMs: number; events: ChordEvent[] } {
    if (this.startMs === null) return { durationMs: 0, events: [] };
    const out = { durationMs: Math.max(0, nowMs - this.startMs), events: [...this.events] };
    this.startMs = null;
    this.events = [];
    return out;
  }
}

/** "C,G,Am,F" like Project I's chordSequence column. */
export const chordSequence = (events: ChordEvent[]): string => events.map(e => e.chord).join(',');

export type Scheduler = (fn: () => void, delayMs: number) => () => void;
export const timeoutScheduler: Scheduler = (fn, delayMs) => { const h = setTimeout(fn, delayMs); return () => clearTimeout(h); };

/**
 * Replays recorded chords at their saved times (the voice track is played by the audio player at the same moment).
 * Recording design: voice file + timestamped chord events, instead of mixing audio into one file as Project I did.
 */
export function schedulePlayback(events: ChordEvent[], play: (chord: Chord) => void, schedule: Scheduler = timeoutScheduler, speed = 1): () => void {
  const cancels = events.map(e => schedule(() => play(e.chord), e.tMs / speed));
  return () => cancels.forEach(c => c());
}
