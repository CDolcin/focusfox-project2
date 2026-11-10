import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Share, Text, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp, useCollection } from '../app/AppContext';
import {
  CHORD_GESTURES,
  INSTRUMENT_INFO,
  setLastPerformance,
  useLastPerformance,
} from '../app/musicState';
import { Chord, Instrument, Recording } from '../core/models';
import { CHORDS } from '../core/gesture/mapping';
import { ChordRecorder, chordSequence, schedulePlayback } from '../core/gesture/recording';
import { Press, PracticeResult, buildSequence, scorePractice } from '../core/gesture/scoring';
import { createId } from '../core/ids';
import { ChordSynth, playFile } from '../services/audio';
import { FrameProcessor, PadGestureSource } from '../services/gestureSource';
import { HandCamera, HandStatus } from '../services/HandCamera';
import ChordDiagram from '../ui/ChordDiagram';
import {
  BackableHeader,
  DeleteX,
  Empty,
  OutlinedPill,
  Panel,
  PillBadge,
  PrimaryButton,
  Row,
  Screen,
  ScreenHeader,
  T,
  useColors,
} from '../ui/kit';
import { colors } from '../ui/theme';

const mmss = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

const ORANGE = '#F7A600';

export function InstrumentsScreen({
  onSelect,
  onSaved,
}: {
  onSelect: (instrument: Instrument) => void;
  onSaved: () => void;
}) {
  const c = useColors();
  const [camera] = useCameraPermissions();

  return (
    <Screen>
      <ScreenHeader title="Study Breaks" subtitle="Make your break productive & fun" />
      <View style={{ height: 16 }} />

      <View style={{ backgroundColor: c.purple, borderRadius: 18, padding: 18 }}>
        <Row>
          <MaterialIcons name="music-note" size={24} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>
            {' Interactive Music'}
          </Text>
        </Row>
        <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
          Play with hand gestures + camera
        </Text>
      </View>

      <View style={{ height: 24 }} />
      <T kind="titleLarge">Choose an instrument</T>
      <View style={{ height: 12 }} />

      <View style={{ gap: 12 }}>
        {INSTRUMENT_INFO.map(instrument => (
          <Panel
            key={instrument.name}
            radius={16}
            onPress={() => onSelect(instrument.name)}
            style={{
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Row>
              <View style={{ backgroundColor: c.purpleLight, borderRadius: 14, padding: 14 }}>
                <Text style={{ fontSize: 22 }}>{instrument.emoji}</Text>
              </View>
              <View style={{ marginLeft: 14 }}>
                <Text style={{ fontWeight: '600', fontSize: 17, color: c.text }}>
                  {instrument.name}
                </Text>
                <T kind="bodyDim">{instrument.label}</T>
              </View>
            </Row>
            <MaterialIcons name="chevron-right" size={24} color={c.textSecondary} />
          </Panel>
        ))}
      </View>

      <View style={{ height: 24 }} />
      <PillBadge
        text={camera?.granted === false ? '● Camera permission needed' : '● Camera ready'}
        bg={camera?.granted === false ? c.border : c.onlineBg}
        color={camera?.granted === false ? c.textSecondary : c.onlineText}
      />
      <T kind="bodyDim" style={{ marginTop: 8 }}>
        Your camera is used only during a performance.
      </T>
      <View style={{ height: 20 }} />
      <OutlinedPill title="🎵 View saved recordings" onPress={onSaved} />
    </Screen>
  );
}

export function GesturesScreen({
  instrument,
  onCamera,
  onPractice,
  onBack,
}: {
  instrument: Instrument;
  onCamera: () => void;
  onPractice: () => void;
  onBack: () => void;
}) {
  const c = useColors();
  const info = INSTRUMENT_INFO.find(item => item.name === instrument)!;
  const synth = useRef<ChordSynth | null>(null);

  useEffect(() => {
    const player = new ChordSynth(instrument);
    synth.current = player;
    void player.init();
    return () => player.dispose();
  }, [instrument]);

  return (
    <Screen>
      <BackableHeader
        title={instrument}
        subtitle="Learn gestures before you play"
        onBack={onBack}
      />
      <View style={{ height: 14 }} />

      <Row style={{ gap: 8 }}>
        <PillBadge text="Beginner" bg={c.purpleLight} color={c.purple} />
        <PillBadge text={info.label} bg={c.surface} color={c.text} />
      </Row>

      <View style={{ height: 20 }} />
      <T kind="titleLarge">Hand gestures</T>
      <T kind="bodyDim" style={{ marginTop: 6, marginBottom: 12 }}>
        Show the camera this hand shape to play each chord - tap a card to hear it
      </T>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {CHORD_GESTURES.map(gesture => (
          <Pressable
            key={gesture.chord}
            onPress={() => synth.current?.play(gesture.chord)}
            accessibilityRole="button"
            accessibilityLabel={`Hear ${gesture.chord} chord`}
            style={{ width: '30.5%', flexGrow: 1 }}
          >
            <Panel style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Row>
                <Text style={{ color: c.text, fontSize: 12 }}>{gesture.chord} chord </Text>
                <MaterialIcons name="play-circle-filled" size={14} color={c.purple} />
              </Row>
              <Text style={{ fontSize: 30, marginVertical: 6 }}>{gesture.emoji}</Text>
              <T kind="labelDim" style={{ marginBottom: 6, fontSize: 10 }}>
                {gesture.gestureName}
              </T>
              <ChordDiagram chord={gesture.chord} instrument={instrument} />
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

export function PerformanceCameraScreen({
  instrument,
  onFinished,
  onBack,
}: {
  instrument: Instrument;
  onFinished: () => void;
  onBack: () => void;
}) {
  const { engine } = useApp();
  const [camPerm, requestCam] = useCameraPermissions();
  const voice = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const rec = useRef(new ChordRecorder());
  const source = useRef(new PadGestureSource());
  const frames = useRef<FrameProcessor | null>(null);
  const micOn = useRef(false);
  const startedAt = useRef(0);
  const finishing = useRef(false);

  const [capture, setCapture] = useState<'preparing' | 'microphone' | 'chords'>('preparing');
  const [elapsed, setElapsed] = useState(0);
  const [last, setLast] = useState<Chord | null>(null);
  const [seq, setSeq] = useState<Chord[]>([]);
  const [hand, setHand] = useState<HandStatus>('loading');
  const [handDetail, setHandDetail] = useState('');
  const [seen, setSeen] = useState<string | null>(null);

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) {
      void requestCam();
    }
  }, [camPerm, requestCam]);

  useEffect(() => {
    let cancelled = false;
    const synth = new ChordSynth(instrument);
    const padSource = source.current;

    const onEvent = (event: { type: string; chord: Chord; tMs: number }) => {
      if (event.type !== 'press' || !rec.current.isRecording) return;

      synth.play(event.chord);
      setLast(event.chord);
      setSeq(previous => [...previous, event.chord]);
      rec.current.press(event.chord, event.tMs);
    };

    void padSource.start(onEvent);
    frames.current = new FrameProcessor(onEvent);

    const prepare = async () => {
      try {
        await synth.init();

        if (cancelled) {
          synth.dispose();
          return;
        }

        const permission = await requestRecordingPermissionsAsync();
        if (cancelled) return;

        if (permission.granted) {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
            shouldRouteThroughEarpiece: false,
          });

          if (cancelled) return;

          await voice.prepareToRecordAsync();
          if (cancelled) return;

          voice.record();
          micOn.current = true;
        }
      } catch {
        // Keep recording chord events if the microphone is unavailable.
      }

      if (cancelled) return;

      startedAt.current = Date.now();
      rec.current.start(startedAt.current);
      setCapture(micOn.current ? 'microphone' : 'chords');
    };

    void prepare();

    const timer = setInterval(() => {
      if (rec.current.isRecording) {
        setElapsed(Date.now() - startedAt.current);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(timer);
      synth.dispose();
      padSource.stop();
      void setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      }).catch(() => undefined);
    };
  }, [instrument]); // eslint-disable-line react-hooks/exhaustive-deps

  const withTimeout = <V,>(promise: Promise<V>, ms: number) =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);

  const stop = async () => {
    if (finishing.current || !rec.current.isRecording) return;

    finishing.current = true;
    const take = rec.current.stop(Date.now());
    let voiceUri: string | null = null;

    if (micOn.current) {
      try {
        await withTimeout(voice.stop(), 4000);

        if (voice.uri) {
          const destination = new File(Paths.document, `voice_${Date.now()}.m4a`);
          new File(voice.uri).copy(destination);
          voiceUri = destination.uri;
        }
      } catch {
        // Keep the chord events if the microphone file could not be saved.
      }
    }

    let saved = false;

    try {
      if (engine) {
        await engine.upsert('recordings', createId('rec'), {
          instrument,
          durationMs: take.durationMs,
          chordEvents: take.events,
          voiceUri,
          voiceStoragePath: null,
          createdAtMs: Date.now(),
        });
        saved = true;
      }
    } catch {
      // The Save button on the next screen can retry.
    }

    setLastPerformance({
      instrument,
      events: take.events,
      durationMs: take.durationMs,
      voiceUri,
      saved,
    });
    onFinished();
  };

  const handMessage =
    hand === 'ready'
      ? seen && seen !== 'None'
        ? `Seeing: ${seen.replace(/_/g, ' ')}`
        : 'Show your hand to the camera'
      : hand === 'loading'
        ? 'Loading hand tracking… (first time downloads ~8 MB)'
        : handDetail || 'Hand tracking unavailable';

  const captureMessage =
    capture === 'preparing'
      ? 'Preparing audio…'
      : capture === 'microphone'
        ? 'Tap to stop. Use the phone speaker so the mic can hear your chords.'
        : 'Tap to stop. This take will replay the chords you play.';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.cameraBg,
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 56 : 40,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Pressable onPress={onBack} accessibilityLabel="Back" style={{ padding: 6 }}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, marginLeft: 6 }}>
            {instrument} Performance
          </Text>
        </Row>

        <View
          style={{
            backgroundColor: colors.high,
            borderRadius: 50,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
            {capture === 'preparing' ? 'GETTING READY' : '● RECORDING'}
          </Text>
        </View>
      </Row>

      <View style={{ height: 14 }} />

      <Row style={{ justifyContent: 'space-between' }}>
        {CHORDS.map(chord => (
          <Pressable
            key={chord}
            onPress={() => source.current.tap(chord)}
            disabled={capture === 'preparing'}
            accessibilityRole="button"
            accessibilityLabel={`Play ${chord}`}
            style={{ alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 }}
          >
            <View
              style={{
                backgroundColor: chord === last ? ORANGE : 'rgba(247,166,0,0.55)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: '#1B1B2E', fontWeight: '800', fontSize: 12 }}>
                {chord}
              </Text>
            </View>
          </Pressable>
        ))}
      </Row>

      <View style={{ height: 10 }} />

      <View
        style={{
          backgroundColor: colors.cameraBg,
          borderRadius: 20,
          aspectRatio: 0.85,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {camPerm?.granted ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
            <HandCamera
              onStatus={(status, detail) => {
                setHand(status);
                setHandDetail(detail ?? '');
              }}
              onFrame={(label, score) => {
                setSeen(label);
                frames.current?.frame(label, score, Date.now());
              }}
            />
          </View>
        ) : (
          <Text style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center', padding: 24 }}>
            Camera access is needed to see your hand gestures. You can still play with the chord tiles above.
          </Text>
        )}

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {last ? `${last} chord` : 'Tap a chord tile or show your hand'}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 11,
              marginTop: 2,
              paddingHorizontal: 12,
              textAlign: 'center',
            }}
          >
            {camPerm?.granted ? handMessage : 'Camera off'}
          </Text>
        </View>
      </View>

      <Text style={{ color: '#fff', fontSize: 30, fontWeight: '700', alignSelf: 'center', marginTop: 16 }}>
        {mmss(elapsed)}
      </Text>

      <Pressable
        onPress={stop}
        disabled={capture === 'preparing'}
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        style={{
          alignSelf: 'center',
          marginTop: 14,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.high,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name="stop" size={32} color="#fff" />
      </Pressable>

      <Text
        style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: 13,
          alignSelf: 'center',
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        {captureMessage}
      </Text>

      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, alignSelf: 'center', marginTop: 6 }}>
        {seq.slice(-8).join('  ')}
      </Text>
    </View>
  );
}

export function PlaybackScreen({
  onBack,
  initialInstrument,
}: {
  onBack: () => void;
  initialInstrument?: Instrument;
}) {
  const { engine } = useApp();
  const c = useColors();
  const last = useLastPerformance();
  const recordings = useCollection('recordings');
  const [tab, setTab] = useState<Instrument>(last?.instrument ?? initialInstrument ?? 'Guitar');
  const active = useRef<{ id: string; stop: () => void } | null>(null);
  const [playback, setPlayback] = useState<{
    id: string;
    percent: number;
    playing: boolean;
  } | null>(null);

  useEffect(() => () => active.current?.stop(), []);

  const play = (
    id: string,
    recording: {
      instrument: Instrument;
      events: Recording['chordEvents'];
      durationMs: number;
      voiceUri: string | null;
    },
  ) => {
    const previous = active.current;
    previous?.stop();

    if (previous?.id === id) {
      setPlayback(null);
      return;
    }

    const playChords = () => {
      const synth = new ChordSynth(recording.instrument);
      const startedAt = performance.now();
      const cancel = schedulePlayback(recording.events, chord => synth.play(chord));

      const tick = setInterval(() => {
        const percent =
          recording.durationMs > 0
            ? Math.min(100, ((performance.now() - startedAt) / recording.durationMs) * 100)
            : 100;

        setPlayback({ id, percent, playing: true });

        if (percent >= 100) clearInterval(tick);
      }, 100);

      const end = setTimeout(() => {
        stopChords();
        setPlayback({ id, percent: 100, playing: false });
      }, recording.durationMs + 1500);

      const stopChords = () => {
        clearInterval(tick);
        clearTimeout(end);
        active.current = null;
        cancel();
        synth.dispose();
      };

      active.current = { id, stop: stopChords };
      setPlayback({ id, percent: 0, playing: true });

      void synth
        .init()
        .then(() => {
          if (active.current?.stop !== stopChords) synth.dispose();
        })
        .catch(() => undefined);
    };

    if (!recording.voiceUri) {
      playChords();
      return;
    }

    const fallback = () => {
      if (recording.events.length) {
        playChords();
      } else {
        setPlayback(null);
        Alert.alert('Recording unavailable', 'The microphone audio could not be played.');
      }
    };

    let player: ReturnType<typeof playFile>;

    try {
      if (recording.voiceUri.startsWith('file://') && !new File(recording.voiceUri).exists) {
        fallback();
        return;
      }

      player = playFile(recording.voiceUri);
    } catch {
      fallback();
      return;
    }

    // The microphone track can already contain the chords.
    const stopAudio = () => {
      clearTimeout(loadTimeout);
      active.current = null;
      subscription.remove();
      player.remove();
    };

    const tryChords = () => {
      if (active.current?.stop !== stopAudio) return;

      stopAudio();
      fallback();
    };

    const loadTimeout = setTimeout(tryChords, 8000);
    const subscription = player.addListener('playbackStatusUpdate', status => {
      if (active.current?.stop !== stopAudio) return;

      if (status.error) {
        tryChords();
        return;
      }

      if (status.didJustFinish) {
        stopAudio();
        setPlayback({ id, percent: 100, playing: false });
        return;
      }

      if (status.playing || status.currentTime > 0) {
        clearTimeout(loadTimeout);
      }

      const percent =
        status.duration > 0
          ? Math.min(100, (status.currentTime / status.duration) * 100)
          : 0;

      setPlayback({ id, percent, playing: true });
    });

    active.current = { id, stop: stopAudio };
    setPlayback({ id, percent: 0, playing: true });
  };

  const isPlaying = (id: string) => playback?.id === id && playback.playing;

  const progressBar = (id: string) => {
    const percent = playback?.id === id ? playback.percent : 0;

    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Playback progress"
        accessibilityValue={{ now: Math.round(percent), min: 0, max: 100 }}
        style={{ height: 6, backgroundColor: c.purpleLight, borderRadius: 3 }}
      >
        <View
          style={{
            height: 6,
            width: `${percent}%`,
            backgroundColor: c.purple,
            borderRadius: 3,
          }}
        />
      </View>
    );
  };

  const save = async () => {
    if (!engine || !last || last.saved) return;

    await engine.upsert('recordings', createId('rec'), {
      instrument: last.instrument,
      durationMs: last.durationMs,
      chordEvents: last.events,
      voiceUri: last.voiceUri,
      voiceStoragePath: null,
      createdAtMs: Date.now(),
    });

    setLastPerformance({ ...last, saved: true });
  };

  const list = recordings
    .filter(recording => recording.instrument === tab)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  return (
    <Screen>
      <BackableHeader
        title="My Performance"
        subtitle="Review and save your study break"
        onBack={onBack}
      />
      <View style={{ height: 16 }} />

      {last ? (
        <>
          <Panel radius={18} style={{ padding: 18 }}>
            <Text style={{ fontWeight: '700', fontSize: 17, color: c.text }}>
              {last.instrument} · {mmss(last.durationMs)}
            </Text>

            <View style={{ height: 10 }} />

            {last.events.length ? (
              <Text style={{ color: c.purple, fontWeight: '700', fontSize: 16 }}>
                {chordSequence(last.events).split(',').join('   ')}
              </Text>
            ) : (
              <T kind="bodyDim">No chords were detected during this take.</T>
            )}

            <View style={{ height: 14 }} />
            {progressBar('latest')}
          </Panel>

          <View style={{ height: 16 }} />
          <PrimaryButton
            title={isPlaying('latest') ? 'Stop playback' : 'Play recording'}
            icon={isPlaying('latest') ? 'stop' : 'play-arrow'}
            onPress={() => play('latest', last)}
          />

          <View style={{ height: 12 }} />

          <Row style={{ gap: 12 }}>
            <OutlinedPill
              style={{ flex: 1 }}
              title="Share"
              onPress={() =>
                Share.share({
                  message: `My FocusFox ${last.instrument} performance: ${chordSequence(last.events).split(',').join(' ')}`,
                })
              }
            />

            <Pressable
              onPress={save}
              disabled={last.saved}
              style={{
                flex: 1,
                borderRadius: 50,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: last.saved ? c.onlineBg : c.purpleLight,
              }}
            >
              <Text style={{ color: last.saved ? c.onlineText : c.purple, fontWeight: '600' }}>
                {last.saved ? 'Saved ✓' : 'Save performance'}
              </Text>
            </Pressable>
          </Row>
        </>
      ) : (
        <T kind="bodyDim">
          Record a new performance from the Music tab, or browse what you&apos;ve already saved below.
        </T>
      )}

      <View style={{ height: 24 }} />
      <T kind="titleLarge">Saved recordings</T>
      <View style={{ height: 10 }} />

      <Panel radius={4} style={{ flexDirection: 'row' }}>
        {INSTRUMENT_INFO.map(item => (
          <Pressable
            key={item.name}
            onPress={() => setTab(item.name)}
            accessibilityRole="tab"
            style={{
              flex: 1,
              paddingVertical: 14,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: tab === item.name ? c.purple : 'transparent',
            }}
          >
            <Text
              style={{
                color: tab === item.name ? c.purple : c.text,
                fontWeight: tab === item.name ? '700' : '400',
              }}
            >
              {item.name}
            </Text>
          </Pressable>
        ))}
      </Panel>

      <View style={{ height: 12 }} />

      {list.length === 0 ? (
        <Empty text={`No ${tab} recordings saved yet.`} />
      ) : (
        <View style={{ gap: 10 }}>
          {list.map(recording => (
            <View
              key={recording.id}
              style={{
                flexDirection: 'row',
                backgroundColor: c.surface,
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: 4,
                  backgroundColor: recording.instrument === 'Guitar' ? colors.green : colors.blue,
                }}
              />

              <View style={{ flex: 1, padding: 14, gap: 10 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row>
                    <Pressable
                      onPress={() =>
                        play(recording.id, {
                          instrument: recording.instrument,
                          events: recording.chordEvents,
                          durationMs: recording.durationMs,
                          voiceUri: recording.voiceUri,
                        })
                      }
                      accessibilityLabel={isPlaying(recording.id) ? 'Stop playback' : 'Play recording'}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.green + '33',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialIcons
                        name={isPlaying(recording.id) ? 'stop' : 'play-arrow'}
                        size={26}
                        color={colors.green}
                      />
                    </Pressable>

                    <View style={{ marginLeft: 12 }}>
                      <Text style={{ fontWeight: '600', color: c.text }}>
                        {recording.instrument} · {mmss(recording.durationMs)}
                      </Text>
                      <T kind="bodyDim">
                        {new Date(recording.createdAtMs).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })} · Saved
                      </T>
                    </View>
                  </Row>

                  <DeleteX
                    onPress={() =>
                      Alert.alert('Delete recording?', undefined, [
                        { text: 'Cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => engine?.remove('recordings', recording.id),
                        },
                      ])
                    }
                  />
                </Row>

                {playback?.id === recording.id && progressBar(recording.id)}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

export function PracticeScreen({
  instrument,
  onBack,
}: {
  instrument: Instrument;
  onBack: () => void;
}) {
  const { settings, updateSettings } = useApp();
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<'camera' | 'pads'>('camera');
  const [handStatus, setHandStatus] = useState<HandStatus>('loading');
  const [handDetail, setHandDetail] = useState('');
  const [seen, setSeen] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [saving, setSaving] = useState(false);

  const synth = useRef<ChordSynth | null>(null);
  const frames = useRef<FrameProcessor | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  const run = useRef<{
    t0: number;
    presses: Press[];
    mode: 'camera' | 'pads';
  } | null>(null);

  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const sequence = useMemo<Chord[]>(() => ['C', 'G', 'Am', 'F', 'D', 'Em'], []);
  const targets = useMemo(() => buildSequence(sequence), [sequence]);

  useEffect(() => {
    mounted.current = true;

    const player = new ChordSynth(instrument);
    synth.current = player;

    void player.init().catch(() => undefined);

    frames.current = new FrameProcessor(event => {
      const current = run.current;

      if (event.type !== 'press' || !current || current.mode !== 'camera') {
        return;
      }

      player.play(event.chord);
      current.presses.push({ chord: event.chord, tMs: event.tMs - current.t0 });
    });

    return () => {
      mounted.current = false;
      run.current = null;

      if (interval.current) {
        clearInterval(interval.current);
        interval.current = null;
      }

      frames.current = null;
      synth.current = null;
      player.dispose();
    };
  }, [instrument]);

  const finish = async () => {
    if (interval.current) {
      clearInterval(interval.current);
      interval.current = null;
    }

    const current = run.current;
    run.current = null;
    if (!current) return;

    const score = scorePractice(targets, current.presses);
    setStep(-1);
    setResult(score);
    setSaving(true);

    try {
      if (current.mode === 'camera') {
        const scores = settingsRef.current.bestCameraPracticeScores ?? {};
        const previous = scores[instrument] ?? 0;

        if (scores[instrument] === undefined || score.score > previous) {
          await updateSettings({
            bestCameraPracticeScores: {
              ...scores,
              [instrument]: Math.max(previous, score.score),
            },
          });
        }
      } else {
        const scores = settingsRef.current.bestPracticeScores;
        const previous = scores[instrument] ?? 0;

        if (scores[instrument] === undefined || score.score > previous) {
          await updateSettings({
            bestPracticeScores: {
              ...scores,
              [instrument]: Math.max(previous, score.score),
            },
          });
        }
      }
    } catch (error) {
      if (mounted.current) {
        Alert.alert('Could not save best score', (error as Error).message);
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const start = () => {
    if (run.current || saving) return;

    if (mode === 'camera' && (!permission?.granted || handStatus !== 'ready')) {
      return;
    }

    frames.current?.reset();
    setResult(null);
    setStep(0);
    run.current = { t0: Date.now(), presses: [], mode };

    const lastTarget = targets[targets.length - 1];
    const end = lastTarget.startMs + lastTarget.windowMs;

    interval.current = setInterval(() => {
      const current = run.current;
      if (!current) return;

      const elapsed = Date.now() - current.t0;

      if (elapsed >= end) {
        void finish();
        return;
      }

      let index = 0;
      targets.forEach((target, i) => {
        if (elapsed >= target.startMs) index = i;
      });
      setStep(index);
    }, 100);
  };

  const stop = () => {
    if (interval.current) {
      clearInterval(interval.current);
      interval.current = null;
    }

    run.current = null;
    frames.current?.reset();
    setStep(-1);
    setResult(null);
  };

  const changeMode = (nextMode: 'camera' | 'pads') => {
    if (run.current || saving) return;

    setMode(nextMode);
    setResult(null);
    setSeen(null);
    frames.current?.reset();

    if (nextMode === 'camera' && mode !== 'camera') {
      setHandStatus('loading');
      setHandDetail('');
    }
  };

  const tapChord = (chord: Chord) => {
    if (mode !== 'pads') return;

    synth.current?.play(chord);

    const current = run.current;
    if (current?.mode === 'pads') {
      current.presses.push({
        chord,
        tMs: Date.now() - current.t0,
      });
    }
  };

  const allowCamera = async () => {
    try {
      const response = await requestPermission();

      if (!response.granted) {
        Alert.alert(
          'Camera permission needed',
          'Allow camera access in your phone settings to practise with gestures. You can also use touch pads.',
        );
      }
    } catch (error) {
      Alert.alert('Camera permission', (error as Error).message);
    }
  };

  const active = step >= 0;
  const bestScore =
    mode === 'camera'
      ? settings.bestCameraPracticeScores?.[instrument]
      : settings.bestPracticeScores[instrument];
  const cameraReady = permission?.granted && handStatus === 'ready';

  return (
    <Screen>
      <BackableHeader
        title="Practice"
        subtitle={`${instrument} · match six chords`}
        onBack={() => {
          stop();
          onBack();
        }}
      />

      <View style={{ height: 14 }} />

      {!active && (
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <OutlinedPill
            title={`${mode === 'camera' ? '✓ ' : ''}Camera gestures`}
            onPress={() => changeMode('camera')}
          />
          <OutlinedPill
            title={`${mode === 'pads' ? '✓ ' : ''}Touch pads`}
            onPress={() => changeMode('pads')}
          />
        </Row>
      )}

      <T kind="bodyDim" style={{ marginTop: 10 }}>
        Input: {mode === 'camera' ? 'Camera gestures' : 'Touch pads'}. Best scores are saved separately.
      </T>

      {mode === 'camera' && (
        <>
          <View style={{ height: 12 }} />

          {permission?.granted ? (
            <>
              <View
                style={{
                  height: 220,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: colors.cameraBg,
                }}
              >
                <HandCamera
                  onFrame={(label, confidence) => {
                    setSeen(label);
                    frames.current?.frame(label, confidence, Date.now());
                  }}
                  onStatus={(status, detail) => {
                    setHandStatus(status);
                    setHandDetail(detail ?? '');
                  }}
                />
              </View>

              <T kind="bodyDim" style={{ marginTop: 8 }}>
                {handStatus === 'ready'
                  ? seen && seen !== 'None'
                    ? `Seeing: ${seen.replace(/_/g, ' ')}`
                    : 'Camera ready — show your hand'
                  : handStatus === 'loading'
                    ? 'Loading hand tracking… Internet is needed to download the model.'
                    : handDetail || 'Hand tracking could not start.'}
              </T>
            </>
          ) : (
            <PrimaryButton title="Allow camera" onPress={allowCamera} />
          )}
        </>
      )}

      <View style={{ height: 16 }} />

      <Panel radius={18} style={{ padding: 20, alignItems: 'center' }}>
        <T kind="bodyDim">
          {active ? `Target ${step + 1} of ${sequence.length}` : 'Chords to match, in order'}
        </T>
        <Text style={{ fontSize: 56, fontWeight: '800', color: c.purple, marginVertical: 8 }}>
          {active ? targets[step].chord : '—'}
        </Text>

        {active ? (
          <>
            <Text style={{ fontSize: 30 }}>
              {CHORD_GESTURES.find(gesture => gesture.chord === targets[step].chord)?.emoji}
            </Text>
            <T kind="bodyDim">
              {CHORD_GESTURES.find(gesture => gesture.chord === targets[step].chord)?.gestureName}
            </T>
          </>
        ) : (
          <T kind="label">{sequence.join(' → ')}</T>
        )}
      </Panel>

      <View style={{ height: 16 }} />

      {active ? (
        <OutlinedPill title="Stop practice" onPress={stop} />
      ) : (
        <PrimaryButton
          title={saving ? 'Saving score…' : result ? 'Try again' : 'Start practice'}
          disabled={saving || (mode === 'camera' && !cameraReady)}
          onPress={start}
        />
      )}

      <T kind="bodyDim" style={{ marginTop: 10 }}>
        Follow the large target chord as it changes. In camera mode, touch tiles cannot score points.
      </T>

      <View style={{ height: 16 }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CHORDS.map(chord => {
          const gesture = CHORD_GESTURES.find(item => item.chord === chord);
          const isTarget = active && targets[step].chord === chord;

          return (
            <Pressable
              key={chord}
              onPress={() => tapChord(chord)}
              disabled={mode === 'camera'}
              accessibilityRole="button"
              accessibilityLabel={`Play ${chord}`}
              style={{
                width: '30.5%',
                flexGrow: 1,
                backgroundColor: isTarget ? ORANGE : c.surface,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 24 }}>{gesture?.emoji}</Text>
              <Text style={{ fontWeight: '700', color: c.purple }}>{chord}</Text>
              <T kind="labelDim" style={{ fontSize: 10, textAlign: 'center' }}>
                {gesture?.gestureName}
              </T>
            </Pressable>
          );
        })}
      </View>

      {result && (
        <Panel radius={18} style={{ padding: 18, marginTop: 16 }}>
          <T kind="headlineLarge" style={{ color: c.purple }}>{result.score}%</T>
          <T kind="bodyDim">
            Accuracy {Math.round(result.accuracy * 100)}%
            {' · '}
            Speed {Math.round(result.timing * 100)}%
          </T>
          <View style={{ height: 8 }} />
          <T kind="body">
            {result.perTarget
              .map((target, index) => `${sequence[index]} ${target.hit ? '✓' : '✗'}`)
              .join('   ')}
          </T>
        </Panel>
      )}

      <T kind="bodyDim" style={{ marginTop: 14 }}>
        Best on {instrument}
        {' '}
        ({mode === 'camera' ? 'camera' : 'touch pads'}):
        {' '}
        {bestScore === undefined ? 'No score yet' : `${bestScore}%`}
      </T>

      <T kind="bodyDim" style={{ marginTop: 8 }}>
        Score = 70% accuracy + 30% speed.
        Incorrect chords before the correct chord reduce accuracy.
        Stopping early does not save a score.
      </T>
    </Screen>
  );
}