import { Chord, Instrument } from '../models';

export const CHORDS: readonly Chord[] = ['C', 'G', 'Am', 'F', 'D', 'Em'];
export const INSTRUMENTS: readonly Instrument[] = ['Guitar', 'Ukulele', 'Piano'];

/** MediaPipe Gesture Recognizer vocabulary -> chord, identical to Project I's GestureRecognizerHelper. */
export const GESTURE_TO_CHORD: Readonly<Record<string, Chord>> = {
  Pointing_Up: 'C', Victory: 'G', ILoveYou: 'Am', Open_Palm: 'F', Thumb_Up: 'D', Closed_Fist: 'Em',
};
export const CHORD_TO_GESTURE_LABEL: Readonly<Record<Chord, string>> = {
  C: 'Pointing up', G: 'Victory', Am: 'I love you', F: 'Open palm', D: 'Thumbs up', Em: 'Closed fist',
};

export function chordForGesture(label: string | null | undefined, score = 1, minScore = 0.5): Chord | null {
  if (!label || score < minScore) return null;
  return GESTURE_TO_CHORD[label] ?? null;
}
