import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Chord, Instrument } from '../core/models';
import { useColors } from './kit';

/** Ukulele fingerings (strings G C E A, fret number, 0 = open). */
const UKE: Record<Chord, number[]> = { C: [0, 0, 0, 3], G: [0, 2, 3, 2], Am: [2, 0, 0, 0], F: [2, 0, 1, 0], D: [2, 2, 2, 0], Em: [0, 4, 3, 2] };
const PIANO_KEY: Record<Chord, number> = { C: 0, G: 4, Am: 5, F: 3, D: 1, Em: 2 }; // white-key index of the root note within C D E F G A B
const ORANGE = '#F7A600';

/** Small chord picture shown under each gesture, like the Project I tiles: orange chord tile (guitar), fretboard (ukulele), keys (piano). */
export default function ChordDiagram({ chord, instrument }: { chord: Chord; instrument: Instrument }) {
  const c = useColors();
  if (instrument === 'Guitar') return <View style={{ backgroundColor: ORANGE, borderRadius: 6, width: 40, height: 28, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '800', color: '#1B1B2E' }}>{chord}</Text></View>;
  if (instrument === 'Ukulele') {
    const W = 36, H = 40;
    return (
      <Svg width={W} height={H} accessibilityLabel={`${chord} ukulele fingering`}>
        {[0, 1, 2, 3].map(i => <Line key={`s${i}`} x1={4 + i * 9.3} y1={4} x2={4 + i * 9.3} y2={H - 2} stroke={c.textSecondary} strokeWidth={1} />)}
        {[0, 1, 2, 3, 4].map(i => <Line key={`f${i}`} x1={4} y1={4 + i * 8.5} x2={W - 4} y2={4 + i * 8.5} stroke={c.textSecondary} strokeWidth={i === 0 ? 2 : 1} />)}
        {UKE[chord].map((f, s) => f > 0 ? <Circle key={s} cx={4 + s * 9.3} cy={4 + (Math.min(f, 4) - 0.5) * 8.5} r={3.2} fill={ORANGE} /> : null)}
      </Svg>
    );
  }
  const keys = 7, W = 42, kw = W / keys, active = PIANO_KEY[chord];
  return (
    <Svg width={W} height={30} accessibilityLabel={`${chord} on piano`}>
      {Array.from({ length: keys }).map((_, i) => <Rect key={i} x={i * kw} y={0} width={kw - 1} height={30} rx={2} fill={i === active ? ORANGE : '#fff'} stroke={c.border} />)}
    </Svg>
  );
}
