import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, updateProfile } from 'firebase/auth';
import { getFirebase } from './firebase';

export interface AppUser { uid: string; email: string; displayName: string; isGuest?: boolean }
export interface AuthService {
  init(): Promise<AppUser | null>;
  onChange(cb: (u: AppUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AppUser>;
  signUp(name: string, email: string, password: string): Promise<AppUser>;
  /** Project I "Guest Mode": a local-only account on this phone (never synced). */
  continueAsGuest(): Promise<AppUser>;
  updateName(name: string): Promise<void>;
  signOut(): Promise<void>;
  readonly mode: 'firebase' | 'local';
}

const GUEST_KEY = 'ff:guest';
/** Shared by both implementations: guest session handling and change notifications. */
abstract class BaseAuth {
  protected listeners = new Set<(u: AppUser | null) => void>();
  protected emit(u: AppUser | null) { this.listeners.forEach(l => l(u)); }
  protected async guest(): Promise<AppUser | null> { const raw = await AsyncStorage.getItem(GUEST_KEY); return raw ? (JSON.parse(raw) as AppUser) : null; }
  async continueAsGuest(): Promise<AppUser> {
    const u: AppUser = { uid: `local_guest_${Date.now().toString(36)}`, email: '', displayName: 'Guest', isGuest: true };
    await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(u)); this.emit(u); return u;
  }
  protected clearGuest() { return AsyncStorage.removeItem(GUEST_KEY); }
}

/** Firebase Auth: same email/password account on any number of phones; session persisted with AsyncStorage (see firebase.ts). */
class FirebaseAuthService extends BaseAuth implements AuthService {
  readonly mode = 'firebase' as const;
  private fb = getFirebase()!;
  private map = (u: { uid: string; email: string | null; displayName: string | null }): AppUser => ({ uid: u.uid, email: u.email ?? '', displayName: u.displayName ?? (u.email ?? '').split('@')[0] });
  constructor() { super(); onAuthStateChanged(this.fb.auth, async u => { if (u) await this.clearGuest(); this.emit(u ? this.map(u) : await this.guest()); }); }
  async init() { const g = await this.guest(); if (g) return g; return new Promise<AppUser | null>(res => { const off = onAuthStateChanged(this.fb.auth, u => { off(); res(u ? this.map(u) : null); }); }); }
  onChange(cb: (u: AppUser | null) => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  async signIn(email: string, password: string) { return this.map((await signInWithEmailAndPassword(this.fb.auth, email.trim(), password)).user); }
  async signUp(name: string, email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(this.fb.auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    const u = this.map({ ...cred.user, displayName: name.trim() }); this.emit(u); return u;
  }
  async updateName(name: string) { if (this.fb.auth.currentUser) { await updateProfile(this.fb.auth.currentUser, { displayName: name.trim() }); this.emit(this.map({ ...this.fb.auth.currentUser, displayName: name.trim() })); } }
  async signOut() { await this.clearGuest(); await fbSignOut(this.fb.auth).catch(() => undefined); this.emit(null); }
}

/** Offline accounts for running without Firebase: like Project I, accounts live on this phone only. */
class LocalAuthService extends BaseAuth implements AuthService {
  readonly mode = 'local' as const;
  private hash = (pw: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pw);
  async init() { const g = await this.guest(); if (g) return g; const raw = await AsyncStorage.getItem('ff:local:session'); return raw ? (JSON.parse(raw) as AppUser) : null; }
  onChange(cb: (u: AppUser | null) => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  private async users(): Promise<Record<string, AppUser & { pw: string }>> { return JSON.parse((await AsyncStorage.getItem('ff:local:users')) ?? '{}'); }
  async signUp(name: string, email: string, password: string) {
    const users = await this.users(); const key = email.trim().toLowerCase();
    if (users[key]) throw new Error('An account with this email already exists.');
    const u: AppUser = { uid: `local_${(await this.hash(key)).slice(0, 20)}`, email: key, displayName: name.trim() };
    users[key] = { ...u, pw: await this.hash(password) };
    await AsyncStorage.setItem('ff:local:users', JSON.stringify(users));
    await this.clearGuest(); await AsyncStorage.setItem('ff:local:session', JSON.stringify(u)); this.emit(u); return u;
  }
  async signIn(email: string, password: string) {
    const rec = (await this.users())[email.trim().toLowerCase()];
    if (!rec) throw new Error('No account found with this email.');
    if (rec.pw !== (await this.hash(password))) throw new Error('Incorrect password.');
    const { pw: _pw, ...u } = rec; await this.clearGuest(); await AsyncStorage.setItem('ff:local:session', JSON.stringify(u)); this.emit(u); return u;
  }
  async updateName(name: string) {
    const raw = await AsyncStorage.getItem('ff:local:session'); if (!raw) return;
    const u = { ...(JSON.parse(raw) as AppUser), displayName: name.trim() }; await AsyncStorage.setItem('ff:local:session', JSON.stringify(u)); this.emit(u);
  }
  async signOut() { await this.clearGuest(); await AsyncStorage.removeItem('ff:local:session'); this.emit(null); }
}

export const createAuthService = (): AuthService => (getFirebase() ? new FirebaseAuthService() : new LocalAuthService());
/** Messages follow Project I's AuthRepository wording. */
export const friendlyAuthError = (e: unknown): string => {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('user-not-found')) return 'No account found with this email.';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Incorrect password.';
  if (code.includes('email-already-in-use')) return 'An account with this email already exists.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('invalid-email')) return 'That email address is not valid.';
  if (code.includes('network')) return 'No connection. Sign-in needs internet the first time on a new phone.';
  return (e as Error)?.message ?? 'Something went wrong.';
};
