import { Chord, Instrument } from '../models';

/**
 * GESTURE PRACTICE SCORING (0-100). Isolated from the camera and recognizer: input is plain data, so it is tested
 * with fixed sequences.
 *
 *  Each target chord has a time window. A target is HIT when its chord is confirmed (a debounced `press`) inside the window.
 *    accuracy credit = 0 on a miss; on a hit 1 minus 0.25 per WRONG chord confirmed earlier in the same window (min 0)
 *    timing credit   = 0 on a miss; on a hit 1 if reaction <= graceMs, falling linearly to 0 at the end of the window
 *    score = round( 100 * (0.7 * mean(accuracy credits) + 0.3 * mean(timing credits)) )  over ALL targets
 *  So a perfect, quick run is 100 and no gestures at all is 0.
 */
export const ACCURACY_WEIGHT = 0.7;
export const TIMING_WEIGHT = 0.3;
export const WRONG_PRESS_PENALTY = 0.25;
export const DEFAULT_WINDOW_MS = 4000;
export const DEFAULT_GRACE_MS = 1000;
export const DEFAULT_LEAD_IN_MS = 1500;

export interface Target { chord: Chord; startMs: number; windowMs: number }
export interface Press { chord: Chord; tMs: number }

export interface TargetResult {
  chord: Chord; hit: boolean; reactionMs: number | null; wrongPresses: number;
  accuracyCredit: number; timingCredit: number;
}
export interface PracticeResult { score: number; accuracy: number; timing: number; perTarget: TargetResult[] }

export interface ScoringConfig { graceMs: number }

/** Lay out a sequence of chords back to back after a lead-in. */
export function buildSequence(chords: readonly Chord[], opts: { leadInMs?: number; windowMs?: number } = {}): Target[] {
  const lead = opts.leadInMs ?? DEFAULT_LEAD_IN_MS;
  const win = opts.windowMs ?? DEFAULT_WINDOW_MS;
  return chords.map((chord, i) => ({ chord, startMs: lead + i * win, windowMs: win }));
}

export function scorePractice(targets: Target[], presses: Press[], cfg: ScoringConfig = { graceMs: DEFAULT_GRACE_MS }): PracticeResult {
  const sorted = [...presses].sort((a, b) => a.tMs - b.tMs);
  const perTarget: TargetResult[] = targets.map(t => {
    const end = t.startMs + t.windowMs;
    const inWindow = sorted.filter(p => p.tMs >= t.startMs && p.tMs < end);
    const hitPress = inWindow.find(p => p.chord === t.chord);
    if (!hitPress) {
      return { chord: t.chord, hit: false, reactionMs: null, wrongPresses: inWindow.length, accuracyCredit: 0, timingCredit: 0 };
    }
    const wrong = inWindow.filter(p => p.tMs < hitPress.tMs && p.chord !== t.chord).length;
    const reaction = hitPress.tMs - t.startMs;
    const span = Math.max(1, t.windowMs - cfg.graceMs);
    const timing = reaction <= cfg.graceMs ? 1 : Math.max(0, 1 - (reaction - cfg.graceMs) / span);
    return { chord: t.chord, hit: true, reactionMs: reaction, wrongPresses: wrong, accuracyCredit: Math.max(0, 1 - WRONG_PRESS_PENALTY * wrong), timingCredit: timing };
  });
  const n = Math.max(1, perTarget.length);
  const accuracy = perTarget.reduce((s, r) => s + r.accuracyCredit, 0) / n;
  const timing = perTarget.reduce((s, r) => s + r.timingCredit, 0) / n;
  const score = Math.round(100 * (ACCURACY_WEIGHT * accuracy + TIMING_WEIGHT * timing));
  return { score: Math.min(100, Math.max(0, score)), accuracy, timing, perTarget };
}

export function updateBestScore(best: Partial<Record<Instrument, number>>, instrument: Instrument, score: number): Partial<Record<Instrument, number>> {
  return (best[instrument] ?? -1) >= score ? best : { ...best, [instrument]: score };
}
