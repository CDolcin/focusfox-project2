// Generates six short piano-like chord WAVs (additive synthesis) into assets/audio/piano_*.wav.
// Project I used a runtime ChordSynth for the piano; this is the offline equivalent.
const fs = require('fs');
const path = require('path');
const RATE = 22050;
const NOTE = { C3: 130.81, E3: 164.81, G3: 196.0, A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F3: 174.61, 'F#4': 369.99, A4: 440.0 };
const CHORDS = {
  c: ['C4', 'E4', 'G3'], g: ['G3', 'B3', 'D4'], am: ['A3', 'C4', 'E4'],
  f: ['F3', 'A3', 'C4'], d: ['D4', 'F#4', 'A4'], em: ['E3', 'G3', 'B3'],
};
function render(freqs, seconds = 2.2) {
  const n = Math.floor(RATE * seconds);
  const out = new Float32Array(n);
  freqs.forEach((f, i) => {
    for (let k = 1; k <= 5; k++) {
      const amp = 1 / (k * k);
      for (let s = 0; s < n; s++) {
        const t = s / RATE;
        const env = Math.exp(-t * (1.6 + k * 0.5)) * Math.min(1, t * 200);
        out[s] += amp * env * Math.sin(2 * Math.PI * f * k * t + i);
      }
    }
  });
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  return out.map(v => (v / peak) * 0.8);
}
function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2));
  return buf;
}
const dir = path.join(__dirname, '..', 'assets', 'audio');
fs.mkdirSync(dir, { recursive: true });
for (const [name, notes] of Object.entries(CHORDS)) {
  fs.writeFileSync(path.join(dir, `piano_${name}.wav`), wav(render(notes.map(n => NOTE[n]))));
  console.log('wrote piano_' + name + '.wav');
}
