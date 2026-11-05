import { Chord } from '../core/models';
import { GestureDebouncer, GestureEvent } from '../core/gesture/debounce';
import { chordForGesture } from '../core/gesture/mapping';

/**
 * The camera layer is isolated behind this interface. Everything downstream (debounce, scoring, recording, audio)
 * only sees `GestureEvent`s, so it is testable without a camera and the recogniser can be swapped.
 *
 * A source calls `emit(label, score, tMs)` for each frame result (label = MediaPipe gesture name, null = no hand).
 */
export interface GestureSource {
  start(onEvent: (e: GestureEvent) => void): Promise<void>;
  stop(): void;
}

/** Turns raw per-frame recogniser output into debounced press/release events. A MediaPipe/TFLite adapter only has to call `frame()`. */
export class FrameProcessor {
  private deb = new GestureDebouncer();
  constructor(private onEvent: (e: GestureEvent) => void) {}
  frame(label: string | null, score: number, tMs: number) {
    for (const e of this.deb.push(chordForGesture(label, score), tMs)) this.onEvent(e);
  }
  reset() { this.deb = new GestureDebouncer(); }
}

/** On-screen chord pads: the source used on emulators, in tests and whenever the camera is unavailable or denied. */
export class PadGestureSource implements GestureSource {
  private cb: ((e: GestureEvent) => void) | null = null;
  async start(onEvent: (e: GestureEvent) => void) { this.cb = onEvent; }
  stop() { this.cb = null; }
  tap(chord: Chord, tMs = Date.now()) { this.cb?.({ type: 'press', chord, tMs }); }
}
