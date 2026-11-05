import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Chord, Instrument } from '../core/models';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES: Record<Instrument, Record<Chord, number>> = {
  Guitar: { C: require('../../assets/audio/guitar_c.m4a'), G: require('../../assets/audio/guitar_g.m4a'), Am: require('../../assets/audio/guitar_am.m4a'), F: require('../../assets/audio/guitar_f.m4a'), D: require('../../assets/audio/guitar_d.m4a'), Em: require('../../assets/audio/guitar_em.m4a') },
  Ukulele: { C: require('../../assets/audio/ukulele_c.m4a'), G: require('../../assets/audio/ukulele_g.m4a'), Am: require('../../assets/audio/ukulele_am.m4a'), F: require('../../assets/audio/ukulele_f.m4a'), D: require('../../assets/audio/ukulele_d.m4a'), Em: require('../../assets/audio/ukulele_em.m4a') },
  Piano: { C: require('../../assets/audio/piano_c.wav'), G: require('../../assets/audio/piano_g.wav'), Am: require('../../assets/audio/piano_am.wav'), F: require('../../assets/audio/piano_f.wav'), D: require('../../assets/audio/piano_d.wav'), Em: require('../../assets/audio/piano_em.wav') },
};

/** One preloaded player per chord (all six are created in init() so the first tap is never silent); replaying rewinds it. */
export class ChordSynth {
  private players = new Map<Chord, AudioPlayer>();
  constructor(private instrument: Instrument) {}
  async init() {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    for (const ch of Object.keys(SOURCES[this.instrument]) as Chord[]) this.player(ch);
  }
  private player(chord: Chord): AudioPlayer {
    let p = this.players.get(chord);
    if (!p) { p = createAudioPlayer(SOURCES[this.instrument][chord]); p.volume = 1; this.players.set(chord, p); }
    return p;
  }
  play(chord: Chord) {
    try {
      const p = this.player(chord);
      p.seekTo(0).catch(() => undefined).then(() => p.play());
    } catch { /* audio is best-effort; never crash a performance */ }
  }
  dispose() { this.players.forEach(p => { try { p.remove(); } catch { /* already released */ } }); this.players.clear(); }
}
export const playFile = (uri: string) => { const p = createAudioPlayer({ uri }); p.volume = 1; p.play(); return p; };
