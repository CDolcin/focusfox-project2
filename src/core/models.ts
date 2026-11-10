/**
 * Data model for FocusFox Project II.
 * Mirrors the Project I Room entities (tasks, notes, flashcards, focus_sessions, recordings)
 * and adds decks, flowers (garden) and settings. Every synced record additionally carries SyncMeta.
 */
export type CollectionName =
  | 'tasks' | 'notes' | 'decks' | 'cards' | 'sessions' | 'flowers' | 'recordings' | 'settings';

export const COLLECTIONS: readonly CollectionName[] = [
  'tasks', 'notes', 'decks', 'cards', 'sessions', 'flowers', 'recordings', 'settings',
];

/** Fields the sync layer adds to every record. `hlc` is the single ordering key (see sync/hlc.ts). */
export interface SyncMeta {
  id: string;
  hlc: string;        // hybrid logical clock stamp of the last write (total order, deterministic)
  deleted: boolean;   // tombstone: record is kept so the deletion itself can sync
  updatedBy: string;  // deviceId that produced the last write (also the final tie-breaker inside hlc)
}
export type SyncRecord<T = object> = T & SyncMeta;

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Instrument = 'Guitar' | 'Ukulele' | 'Piano';
export type Chord = 'C' | 'G' | 'Am' | 'F' | 'D' | 'Em';

export interface Task {
  title: string;
  description: string;
  priority: Priority;
  deadlineMs: number;
  reminderMinutesBefore: 5 | 15 | 30 | 60;
  completed: boolean;
  completedAtMs: number | null;
  createdAtMs: number;
  imageUris: string[];          // local URIs (max 5); cloud copies are tracked in imagePaths
  imagePaths: string[];         // Firebase Storage paths once uploaded
}

export interface Note {
  title: string;
  content: string;
  colorTag: number;             // index into the accent palette (left stripe)
  createdAtMs: number;
}

export interface Deck {
  name: string;
  createdAtMs: number;
  /** Set when this deck has been published for sharing (owner side). */
  shareCode: string | null;
  /** Set when this deck is an imported snapshot (recipient side). */
  importedFrom: { code: string; ownerUid: string; version: number } | null;
}

export interface Card {
  deckId: string;
  question: string;
  answer: string;
  mastered: boolean;
  /** For imported cards: id of the card in the shared snapshot. Cleared when the recipient edits the card. */
  origin: { sharedCardId: string } | null;
}

export interface FocusSession {
  // Flashcard module selected for this focus session.
  moduleId?: string | null;

  label: string;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  startedAtMs: number;
  endedAtMs: number;
}

export type FlowerSpecies = 'daisy' | 'tulip' | 'sunflower' | 'poppy' | 'rose' | 'lotus';
export interface Flower {
  species: FlowerSpecies;
  source: 'focus' | 'task';
  sourceId: string;
  plantedAtMs: number;
  /** Local calendar day the flower was earned on (yyyy-mm-dd), used for daily caps. */
  dayKey: string;
}

export interface ChordEvent { chord: Chord; tMs: number }
export interface Recording {
  instrument: Instrument;
  durationMs: number;
  chordEvents: ChordEvent[];
  voiceUri: string | null;
  voiceStoragePath: string | null;
  createdAtMs: number;
}

/** Mirrors Project I's AppPreferences (focus goals, sessions per cycle, focus background, notifications, dark-mode override). */
export interface Settings {
  focusMinutes: number;
  breakMinutes: number;
  sessionsGoal: number;
  backgroundChoice: number;        // index into FOCUS_BACKGROUNDS
  notificationsEnabled: boolean;
  darkModeOverride: 0 | 1 | 2;     // 0 = follow system, 1 = light, 2 = dark
  bestPracticeScores: Partial<Record<Instrument, number>>;
  friendCodes?: string[];
  friendCode?: string | null;
  bestCameraPracticeScores?: Partial<Record<Instrument, number>>;
}
export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25, breakMinutes: 5, sessionsGoal: 4, backgroundChoice: 0,
  notificationsEnabled: true, darkModeOverride: 0, bestPracticeScores: {},
};
export const SETTINGS_ID = 'prefs';

export interface DataTypes {
  tasks: Task; notes: Note; decks: Deck; cards: Card;
  sessions: FocusSession; flowers: Flower; recordings: Recording; settings: Settings;
}
