import { useEffect, useState } from 'react';
import { Chord, ChordEvent, Instrument } from '../core/models';

/** The take that was just recorded (Project I's MusicViewModel.lastPerformance) so it survives camera -> playback navigation. */
export interface LastPerformance { instrument: Instrument; events: ChordEvent[]; durationMs: number; voiceUri: string | null; saved: boolean }
let current: LastPerformance | null = null;
const subs = new Set<() => void>();
export const setLastPerformance = (p: LastPerformance | null) => { current = p; subs.forEach(f => f()); };
export const getLastPerformance = () => current;
export function useLastPerformance(): LastPerformance | null {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return current;
}

export interface ChordGesture { chord: Chord; emoji: string; gestureName: string }
/** Mirrors Project I CHORD_GESTURES. */
export const CHORD_GESTURES: ChordGesture[] = [
  { chord: 'C', emoji: '👆', gestureName: 'Pointing up' }, { chord: 'G', emoji: '✌️', gestureName: 'Victory' },
  { chord: 'Am', emoji: '🤟', gestureName: 'I love you' }, { chord: 'F', emoji: '🖐️', gestureName: 'Open palm' },
  { chord: 'D', emoji: '👍', gestureName: 'Thumbs up' }, { chord: 'Em', emoji: '✊', gestureName: 'Closed fist' },
];
export const INSTRUMENT_INFO: Array<{ name: Instrument; label: string; emoji: string }> = [
  { name: 'Guitar', label: '6 chords', emoji: '🎸' }, { name: 'Ukulele', label: '6 chords', emoji: '🎵' }, { name: 'Piano', label: '6 notes', emoji: '🎹' },
];
