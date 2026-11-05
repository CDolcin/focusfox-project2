import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp, useCollection } from '../app/AppContext';
import { CHORD_GESTURES, INSTRUMENT_INFO, LastPerformance, setLastPerformance, useLastPerformance } from '../app/musicState';
import { Chord, Instrument, Recording, SyncRecord } from '../core/models';
import { CHORDS, CHORD_TO_GESTURE_LABEL } from '../core/gesture/mapping';
import { ChordRecorder, chordSequence, schedulePlayback } from '../core/gesture/recording';
import { Press, PracticeResult, buildSequence, scorePractice, updateBestScore } from '../core/gesture/scoring';
import { createId } from '../core/ids';
import { ChordSynth, playFile } from '../services/audio';
import { FrameProcessor, PadGestureSource } from '../services/gestureSource';
import { HandCamera, HandStatus } from '../services/HandCamera';
import ChordDiagram from '../ui/ChordDiagram';
import { BackableHeader, DeleteX, Empty, OutlinedPill, Panel, PillBadge, PrimaryButton, Row, Screen, ScreenHeader, T, useColors } from '../ui/kit';
import { colors } from '../ui/theme';

const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const ORANGE = '#F7A600';

/** Study Breaks (Music tab). */
export function InstrumentsScreen({ onSelect, onSaved }: { onSelect: (i: Instrument) => void; onSaved: () => void }) {
  const c = useColors(); const [camera] = useCameraPermissions();
  return (
    <Screen>
      <ScreenHeader title="Study Breaks" subtitle="Make your break productive & fun" />
      <View style={{ height: 16 }} />
      <View style={{ backgroundColor: c.purple, borderRadius: 18, padding: 18 }}>
        <Row><MaterialIcons name="music-note" size={24} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}> Interactive Music</Text></Row>
        <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>Play with hand gestures + camera</Text>
      </View>
      <View style={{ height: 24 }} />
      <T kind="titleLarge">Choose an instrument</T>
      <View style={{ height: 12 }} />
      <View style={{ gap: 12 }}>
        {INSTRUMENT_INFO.map(i => (
          <Panel key={i.name} radius={16} onPress={() => onSelect(i.name)} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Row>
              <View style={{ backgroundColor: c.purpleLight, borderRadius: 14, padding: 14 }}><Text style={{ fontSize: 22 }}>{i.emoji}</Text></View>
              <View style={{ marginLeft: 14 }}><Text style={{ fontWeight: '600', fontSize: 17, color: c.text }}>{i.name}</Text><T kind="bodyDim">{i.label}</T></View>
            </Row>
            <MaterialIcons name="chevron-right" size={24} color={c.textSecondary} />
          </Panel>
        ))}
      </View>
      <View style={{ height: 24 }} />
      <PillBadge text={camera?.granted === false ? '● Camera permission needed' : '● Camera ready'} bg={camera?.granted === false ? c.border : c.onlineBg} color={camera?.granted === false ? c.textSecondary : c.onlineText} />
      <T kind="bodyDim" style={{ marginTop: 8 }}>Your camera is used only during a performance.</T>
      <View style={{ height: 20 }} />
      <OutlinedPill title="🎵 View saved recordings" onPress={onSaved} />
    </Screen>
  );
}

/** Instrument page: learn the six gestures (tap a card to hear the chord), then open the camera or practise for a score. */
export function GesturesScreen({ instrument, onCamera, onPractice, onBack }: { instrument: Instrument; onCamera: () => void; onPractice: () => void; onBack: () => void }) {
  const c = useColors();
  const info = INSTRUMENT_INFO.find(i => i.name === instrument)!;
  const synth = useRef<ChordSynth | null>(null);
  useEffect(() => { const s = new ChordSynth(instrument); synth.current = s; void s.init(); return () => s.dispose(); }, [instrument]);
  return (
    <Screen>
      <BackableHeader title={instrument} subtitle="Learn gestures before you play" onBack={onBack} />
      <View style={{ height: 14 }} />
      <Row style={{ gap: 8 }}><PillBadge text="Beginner" bg={c.purpleLight} color={c.purple} /><PillBadge text={info.label} bg={c.surface} color={c.text} /></Row>
      <View style={{ height: 20 }} />
      <T kind="titleLarge">Hand gestures</T>
      <T kind="bodyDim" style={{ marginTop: 6, marginBottom: 12 }}>Show the camera this hand shape to play each chord - tap a card to hear it</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {CHORD_GESTURES.map(g => (
          <Pressable key={g.chord} onPress={() => synth.current?.play(g.chord)} accessibilityRole="button" accessibilityLabel={`Hear ${g.chord} chord`} style={{ width: '30.5%', flexGrow: 1 }}>
            <Panel style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Row><Text style={{ color: c.text, fontSize: 12 }}>{g.chord} chord </Text><MaterialIcons name="play-circle-filled" size={14} color={c.purple} /></Row>
              <Text style={{ fontSize: 30, marginVertical: 6 }}>{g.emoji}</Text>
              <T kind="labelDim" style={{ marginBottom: 6, fontSize: 10 }}>{g.gestureName}</T>
              <ChordDiagram chord={g.chord} instrument={instrument} />
            </Panel>
          </Pressable>
        ))}
      </View>
      <View style={{ height: 24 }} />
      <PrimaryButton title="Open Camera & Play" onPress={onCamera} />
      <View style={{ height: 10 }} />
      <OutlinedPill title="🎯 Practice with a score" onPress={onPractice} />
      <View style={{ height: 28 }} />
      <T kind="titleLarge">How it works</T>
      <View style={{ height: 10 }} />
      <T kind="bodyDim">{'1  Show your hand   ->   2  Gesture detected   ->   3  Chord plays'}</T>
      <View style={{ height: 10 }} />
      <T kind="bodyDim">Tip: keep your hand inside the camera guide, well lit and a few steps back.</T>
    </Screen>
  );
}

/** Dark performance screen. The hand-tracking camera plays chords; the tiles at the top light up and also work as tap pads. */
export function PerformanceCameraScreen({ instrument, onFinished, onBack }: { instrument: Instrument; onFinished: () => void; onBack: () => void }) {
  const { engine } = useApp();
  const [camPerm, requestCam] = useCameraPermissions();
  const voice = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const synth = useRef<ChordSynth | null>(null);
  const rec = useRef(new ChordRecorder());
  const source = useRef(new PadGestureSource());
  const frames = useRef<FrameProcessor | null>(null);
  const micOn = useRef(false);
  const startedAt = useRef(Date.now());
  const finishing = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [last, setLast] = useState<Chord | null>(null);
  const [seq, setSeq] = useState<Chord[]>([]);
  const [hand, setHand] = useState<HandStatus>('loading');
  const [handDetail, setHandDetail] = useState('');
  const [seen, setSeen] = useState<string | null>(null);

  useEffect(() => { if (camPerm && !camPerm.granted && camPerm.canAskAgain) void requestCam(); }, [camPerm, requestCam]);
  useEffect(() => {
    const s = new ChordSynth(instrument); synth.current = s; void s.init();
    const onEvent = (e: { type: string; chord: Chord; tMs: number }) => {
      if (e.type !== 'press') return;
      s.play(e.chord); setLast(e.chord); setSeq(q => [...q, e.chord]); rec.current.press(e.chord, e.tMs);
    };
    void source.current.start(onEvent as never);
    frames.current = new FrameProcessor(onEvent as never);
    startedAt.current = Date.now(); rec.current.start(startedAt.current);        // chords are timed from the moment the screen opens
    (async () => {
      try {
        const p = await requestRecordingPermissionsAsync();
        if (p.granted) { await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }); await voice.prepareToRecordAsync(); voice.record(); micOn.current = true; }
      } catch { /* the voice track is optional; chords are still recorded */ }
    })();
    const t = setInterval(() => setElapsed(Date.now() - startedAt.current), 500);
    return () => { clearInterval(t); s.dispose(); source.current.stop(); setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined); };
  }, [instrument]); // eslint-disable-line react-hooks/exhaustive-deps

  const withTimeout = <V,>(p: Promise<V>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  /** Stop, keep the voice file, and SAVE the take straight away so a recording can never be lost; then open My Performance. */
  const stop = async () => {
    if (finishing.current) return; finishing.current = true;
    const out = rec.current.stop(Date.now());
    let voiceUri: string | null = null;
    if (micOn.current) {
      try {
        await withTimeout(voice.stop(), 4000);
        if (voice.uri) { const dest = new File(Paths.document, `voice_${Date.now()}.m4a`); new File(voice.uri).copy(dest); voiceUri = dest.uri; }
      } catch { /* keep chords only */ }
    }
    let saved = false;
    try {
      if (engine) { await engine.upsert('recordings', createId('rec'), { instrument, durationMs: out.durationMs, chordEvents: out.events, voiceUri, voiceStoragePath: null, createdAtMs: Date.now() }); saved = true; }
    } catch { /* the Save button on the next screen can retry */ }
    setLastPerformance({ instrument, events: out.events, durationMs: out.durationMs, voiceUri, saved });
    onFinished();
  };
  const panelBg = colors.cameraBg;
  const handMsg = hand === 'ready' ? (seen && seen !== 'None' ? `Seeing: ${seen.replace(/_/g, ' ')}` : 'Show your hand to the camera') : hand === 'loading' ? 'Loading hand tracking… (first time downloads ~8 MB)' : handDetail || 'Hand tracking unavailable';
  return (
    <View style={{ flex: 1, backgroundColor: colors.cameraBg, padding: 20, paddingTop: Platform.OS === 'ios' ? 56 : 40 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row><Pressable onPress={onBack} accessibilityLabel="Back" style={{ padding: 6 }}><MaterialIcons name="arrow-back" size={24} color="#fff" /></Pressable><Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, marginLeft: 6 }}>{instrument} Performance</Text></Row>
        <View style={{ backgroundColor: colors.high, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>● RECORDING</Text></View>
      </Row>
      <View style={{ height: 14 }} />
      <Row style={{ justifyContent: 'space-between' }}>
        {CHORDS.map(ch => (
          <Pressable key={ch} onPress={() => source.current.tap(ch)} accessibilityRole="button" accessibilityLabel={`Play ${ch}`} style={{ alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 }}>
            <View style={{ backgroundColor: ch === last ? ORANGE : 'rgba(247,166,0,0.55)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 }}><Text style={{ color: '#1B1B2E', fontWeight: '800', fontSize: 12 }}>{ch}</Text></View>
          </Pressable>
        ))}
      </Row>
      <View style={{ height: 10 }} />
      <View style={{ backgroundColor: panelBg, borderRadius: 20, aspectRatio: 0.85, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {camPerm?.granted
          ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}><HandCamera onStatus={(s, d) => { setHand(s); setHandDetail(d ?? ''); }} onFrame={(label, score) => { setSeen(label); frames.current?.frame(label, score, Date.now()); }} /></View>
          : <Text style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', padding: 24 }}>Camera access is needed to see your hand gestures. You can still play with the chord tiles above.</Text>}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 12, alignItems: 'center' }} pointerEvents="none">
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{last ? `${last} chord` : 'Tap a chord tile or show your hand'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2, paddingHorizontal: 12, textAlign: 'center' }}>{camPerm?.granted ? handMsg : 'Camera off'}</Text>
        </View>
      </View>
      <Text style={{ color: '#fff', fontSize: 30, fontWeight: '700', alignSelf: 'center', marginTop: 16 }}>{mmss(elapsed)}</Text>
      <Pressable onPress={stop} accessibilityRole="button" accessibilityLabel="Stop recording" style={{ alignSelf: 'center', marginTop: 14, width: 64, height: 64, borderRadius: 32, backgroundColor: colors.high, alignItems: 'center', justifyContent: 'center' }}><MaterialIcons name="stop" size={32} color="#fff" /></Pressable>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, alignSelf: 'center', marginTop: 8 }}>Tap to stop recording</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, alignSelf: 'center', marginTop: 6 }}>{seq.length ? seq.slice(-8).join('  ') : ''}</Text>
    </View>
  );
}

/** My Performance: review the take you just recorded, play/save it, and browse saved recordings per instrument. */
export function PlaybackScreen({ onBack, initialInstrument }: { onBack: () => void; initialInstrument?: Instrument }) {
  const { engine } = useApp(); const c = useColors();
  const last = useLastPerformance();
  const recordings = useCollection('recordings');
  const [tab, setTab] = useState<Instrument>(last?.instrument ?? initialInstrument ?? 'Guitar');
  const stopRef = useRef<null | (() => void)>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopRef.current?.(), []);

  const play = (r: { instrument: Instrument; events: Recording['chordEvents']; durationMs: number; voiceUri: string | null }) => {
    if (stopRef.current) { stopRef.current(); return; }
    const s = new ChordSynth(r.instrument); void s.init();
    const voicePlayer = r.voiceUri ? playFile(r.voiceUri) : null;
    const cancel = schedulePlayback(r.events, ch => s.play(ch));
    const end = setTimeout(() => stopRef.current?.(), r.durationMs + 1500);
    setPlaying(true);
    stopRef.current = () => { clearTimeout(end); cancel(); s.dispose(); voicePlayer?.remove(); stopRef.current = null; setPlaying(false); };
  };
  const save = async () => {
    if (!engine || !last || last.saved) return;
    await engine.upsert('recordings', createId('rec'), { instrument: last.instrument, durationMs: last.durationMs, chordEvents: last.events, voiceUri: last.voiceUri, voiceStoragePath: null, createdAtMs: Date.now() });
    setLastPerformance({ ...last, saved: true });
  };
  const list = recordings.filter(r => r.instrument === tab).sort((a, b) => b.createdAtMs - a.createdAtMs);
  return (
    <Screen>
      <BackableHeader title="My Performance" subtitle="Review and save your study break" onBack={onBack} />
      <View style={{ height: 16 }} />
      {last ? (
        <>
          <Panel radius={18} style={{ padding: 18 }}>
            <Text style={{ fontWeight: '700', fontSize: 17, color: c.text }}>{last.instrument} · {mmss(last.durationMs)}</Text>
            <View style={{ height: 10 }} />
            {last.events.length ? <Text style={{ color: c.purple, fontWeight: '700', fontSize: 16 }}>{chordSequence(last.events).split(',').join('   ')}</Text> : <T kind="bodyDim">No chords were detected during this take.</T>}
            <View style={{ height: 14 }} />
            <View style={{ height: 6, backgroundColor: c.purpleLight, borderRadius: 3 }}><View style={{ height: 6, width: playing ? '50%' : '0%', backgroundColor: c.purple, borderRadius: 3 }} /></View>
          </Panel>
          <View style={{ height: 16 }} />
          <PrimaryButton title={playing ? 'Stop playback' : 'Play recording'} icon="play-arrow" onPress={() => play(last)} />
          <View style={{ height: 12 }} />
          <Row style={{ gap: 12 }}>
            <OutlinedPill style={{ flex: 1 }} title="Share" onPress={() => Share.share({ message: `My FocusFox ${last.instrument} performance: ${chordSequence(last.events).split(',').join(' ')}` })} />
            <Pressable onPress={save} disabled={last.saved} style={{ flex: 1, borderRadius: 50, paddingVertical: 10, alignItems: 'center', backgroundColor: last.saved ? c.onlineBg : c.purpleLight }}><Text style={{ color: last.saved ? c.onlineText : c.purple, fontWeight: '600' }}>{last.saved ? 'Saved ✓' : 'Save performance'}</Text></Pressable>
          </Row>
        </>
      ) : <T kind="bodyDim">Record a new performance from the Music tab, or browse what you've already saved below.</T>}
      <View style={{ height: 24 }} />
      <T kind="titleLarge">Saved recordings</T>
      <View style={{ height: 10 }} />
      <Panel radius={4} style={{ flexDirection: 'row' }}>
        {INSTRUMENT_INFO.map(i => (
          <Pressable key={i.name} onPress={() => setTab(i.name)} accessibilityRole="tab" style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === i.name ? c.purple : 'transparent' }}>
            <Text style={{ color: tab === i.name ? c.purple : c.text, fontWeight: tab === i.name ? '700' : '400' }}>{i.name}</Text>
          </Pressable>
        ))}
      </Panel>
      <View style={{ height: 12 }} />
      {list.length === 0 ? <Empty text={`No ${tab} recordings saved yet.`} /> : (
        <View style={{ gap: 10 }}>
          {list.map((r: SyncRecord<Recording>) => (
            <View key={r.id} style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden' }}>
              <View style={{ width: 4, backgroundColor: r.instrument === 'Guitar' ? colors.green : colors.blue }} />
              <Row style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
                <Row>
                  <Pressable onPress={() => play({ instrument: r.instrument, events: r.chordEvents, durationMs: r.durationMs, voiceUri: r.voiceUri })} accessibilityLabel="Play recording" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green + '33', alignItems: 'center', justifyContent: 'center' }}><MaterialIcons name="play-arrow" size={26} color={colors.green} /></Pressable>
                  <View style={{ marginLeft: 12 }}><Text style={{ fontWeight: '600', color: c.text }}>{r.instrument} · {mmss(r.durationMs)}</Text><T kind="bodyDim">{new Date(r.createdAtMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · Saved</T></View>
                </Row>
                <DeleteX onPress={() => Alert.alert('Delete recording?', undefined, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => engine?.remove('recordings', r.id) }])} />
              </Row>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

/** Practice: match the shown chords in order; score 0-100 (accuracy + timing) from core/gesture/scoring (independent of the camera). */
export function PracticeScreen({ instrument, onBack }: { instrument: Instrument; onBack: () => void }) {
  const { settings, updateSettings } = useApp(); const c = useColors();
  const synth = useRef<ChordSynth | null>(null); const source = useRef(new PadGestureSource());
  const sequence = useMemo<Chord[]>(() => ['C', 'G', 'Am', 'F', 'D', 'Em'], []);
  const targets = useMemo(() => buildSequence(sequence), [sequence]);
  const run = useRef<{ t0: number; presses: Press[] } | null>(null);
  const [step, setStep] = useState(-1); const [result, setResult] = useState<PracticeResult | null>(null);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  useEffect(() => {
    const s = new ChordSynth(instrument); synth.current = s; void s.init();
    void source.current.start(e => { if (e.type !== 'press') return; s.play(e.chord); run.current?.presses.push({ chord: e.chord, tMs: e.tMs - run.current.t0 }); });
    return () => { s.dispose(); source.current.stop(); };
  }, [instrument]);
  const finish = async () => {
    const r = run.current; run.current = null; setStep(-1); if (!r) return;
    const res = scorePractice(targets, r.presses); setResult(res);
    const best = updateBestScore(settingsRef.current.bestPracticeScores, instrument, res.score);
    if (best !== settingsRef.current.bestPracticeScores) await updateSettings({ bestPracticeScores: best });
  };
  const start = () => {
    setResult(null); run.current = { t0: Date.now(), presses: [] }; setStep(0);
    const end = targets[targets.length - 1].startMs + targets[targets.length - 1].windowMs;
    const id = setInterval(() => {
      const el = Date.now() - run.current!.t0;
      let idx = 0; targets.forEach((t, i) => { if (el >= t.startMs) idx = i; }); setStep(idx);
      if (el >= end) { clearInterval(id); void finish(); }
    }, 200);
  };
  return (
    <Screen>
      <BackableHeader title="Practice" subtitle={`${instrument} · match the chords, get a score`} onBack={onBack} />
      <View style={{ height: 16 }} />
      <Panel radius={18} style={{ padding: 20, alignItems: 'center' }}>
        <T kind="bodyDim">{step >= 0 ? 'Play this chord now' : 'Chords to match, in order'}</T>
        <Text style={{ fontSize: 56, fontWeight: '800', color: c.purple, marginVertical: 8 }}>{step >= 0 ? targets[step].chord : '—'}</Text>
        {step >= 0 ? <Text style={{ fontSize: 28 }}>{CHORD_GESTURES.find(g => g.chord === targets[step].chord)?.emoji}</Text> : <T kind="label">{sequence.join(' → ')}</T>}
      </Panel>
      <View style={{ height: 16 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CHORDS.map(ch => (
          <Pressable key={ch} onPress={() => source.current.tap(ch)} accessibilityRole="button" accessibilityLabel={`Play ${ch}`} style={{ width: '30.5%', flexGrow: 1, backgroundColor: step >= 0 && targets[step].chord === ch ? ORANGE : c.surface, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 22 }}>{CHORD_GESTURES.find(g => g.chord === ch)?.emoji}</Text>
            <Text style={{ fontWeight: '700', color: c.purple }}>{ch}</Text><T kind="labelDim" style={{ fontSize: 9 }}>{CHORD_TO_GESTURE_LABEL[ch]}</T>
          </Pressable>
        ))}
      </View>
      <View style={{ height: 20 }} />
      {step < 0 && <PrimaryButton title={result ? 'Try again' : 'Start practice'} onPress={start} />}
      {result && (
        <Panel radius={18} style={{ padding: 18, marginTop: 16 }}>
          <T kind="headlineLarge" style={{ color: c.purple }}>{result.score}%</T>
          <T kind="bodyDim">Accuracy {Math.round(result.accuracy * 100)}% · Speed {Math.round(result.timing * 100)}%</T>
          <View style={{ height: 8 }} />
          <T kind="body">{result.perTarget.map((t, i) => `${sequence[i]} ${t.hit ? '✓' : '✗'}`).join('   ')}</T>
        </Panel>
      )}
      <T kind="bodyDim" style={{ marginTop: 14 }}>Best on {instrument}: {settings.bestPracticeScores[instrument] ?? '—'}%. Score = 70% accuracy + 30% speed; a wrong chord before the right one costs accuracy.</T>
    </Screen>
  );
}
