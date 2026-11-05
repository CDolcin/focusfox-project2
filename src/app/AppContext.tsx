import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { CollectionName, DEFAULT_SETTINGS, DataTypes, SETTINGS_ID, Settings, SyncRecord } from '../core/models';
import { LocalDb, SyncEngine } from '../core/sync';
import { createId } from '../core/ids';
import { AppUser, AuthService, createAuthService } from '../services/auth';
import { asyncStorageKV } from '../services/asyncStorageKV';
import { FirestoreRemote } from '../services/firestoreRemote';
import { FirestoreShareStore, MemoryShareStore, ShareStore } from '../services/shareService';
import { getFirebase } from '../services/firebase';
import { PaletteContext } from '../ui/kit';
import { colors, darkColors } from '../ui/theme';

export interface SyncStatus { online: boolean; syncing: boolean; pending: number; dead: number; lastSyncAt: number | null; error: string | null }
interface Ctx {
  auth: AuthService; user: AppUser | null; ready: boolean;
  engine: SyncEngine | null; shares: ShareStore; settings: Settings; status: SyncStatus; cloud: boolean;
  syncNow(): Promise<void>; updateSettings(p: Partial<Settings>): Promise<void>;
  /** Profile photo is a path on THIS phone, so it is kept in local storage and never synced. */
  photoUri: string | null; setPhotoUri(uri: string | null): Promise<void>;
  /** Badge state like Project I's ONLINE pill, extended with offline / syncing / local-only. */
  badge: 'online' | 'offline' | 'syncing' | 'local';
}
const AppCtx = createContext<Ctx>(null as never);
export const useApp = () => useContext(AppCtx);

const demoShares = new MemoryShareStore();
async function deviceId(): Promise<string> {
  let id = await AsyncStorage.getItem('ff:deviceId');
  if (!id) { id = createId('dev').replace(/\./g, '_'); await AsyncStorage.setItem('ff:deviceId', id); }
  return id;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => createAuthService(), []);
  const fb = useMemo(() => getFirebase(), []);
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SyncStatus>({ online: true, syncing: false, pending: 0, dead: 0, lastSyncAt: null, error: null });
  const [photoUri, setPhoto] = useState<string | null>(null);
  const online = useRef(true);
  const busy = useRef(false);
  const shares = useMemo<ShareStore>(() => (fb ? new FirestoreShareStore(fb.db) : demoShares), [fb]);

  useEffect(() => { auth.init().then(u => { setUser(u); setReady(true); }); return auth.onChange(setUser); }, [auth]);

  // Build one engine per signed-in account. Local data is namespaced by uid, so accounts never mix on one phone.
  useEffect(() => {
    if (!user) { setEngine(null); return; }
    let cancelled = false; let eng: SyncEngine | null = null;
    (async () => {
      const remote = fb && !user.uid.startsWith('local_') ? new FirestoreRemote(fb.db, user.uid) : null;
      eng = await SyncEngine.create({ db: new LocalDb(asyncStorageKV, user.uid), remote, deviceId: await deviceId() });
      if (cancelled) return;
      setEngine(eng);
    })();
    return () => { cancelled = true; eng?.stopRealtime(); };
  }, [user, fb]);

  const refreshStatus = useCallback(async (p: Partial<SyncStatus> = {}) => {
    if (!engine) return;
    setStatus(s => ({ ...s, ...p }));
    const [pending, dead] = [await engine.pendingCount(), (await engine.deadOps()).length];
    setStatus(s => ({ ...s, pending, dead }));
  }, [engine]);

  const syncNow = useCallback(async () => {
    if (!engine || busy.current || !online.current) return;
    busy.current = true; await refreshStatus({ syncing: true });
    try { await engine.sync(); await refreshStatus({ syncing: false, lastSyncAt: Date.now(), error: null }); }
    catch (e) { await refreshStatus({ syncing: false, error: (e as Error).message }); }
    finally { busy.current = false; }
  }, [engine, refreshStatus]);

  // Triggers: start, reconnect, foreground, real-time listeners, and a short debounce after local writes.
  useEffect(() => {
    if (!engine) return;
    void syncNow(); void engine.startRealtime();
    const net = NetInfo.addEventListener(s => { const on = !!(s.isConnected && s.isInternetReachable !== false); online.current = on; setStatus(x => ({ ...x, online: on })); if (on) void syncNow(); });
    const app = AppState.addEventListener('change', st => { if (st === 'active') void syncNow(); });
    let t: ReturnType<typeof setTimeout> | undefined;
    const offs = (['tasks', 'notes', 'decks', 'cards', 'sessions', 'flowers', 'recordings', 'settings'] as CollectionName[]).map(c => engine.onChange(c, () => {
      void refreshStatus(); clearTimeout(t); t = setTimeout(() => void syncNow(), 1500);
    }));
    const load = async () => { const s = await engine.get('settings', SETTINGS_ID); setSettings({ ...DEFAULT_SETTINGS, ...(s ?? {}) }); };
    void load(); const offSettings = engine.onChange('settings', load);
    return () => { net(); app.remove(); offs.forEach(o => o()); offSettings(); clearTimeout(t); engine.stopRealtime(); };
  }, [engine, syncNow, refreshStatus]);

  useEffect(() => { if (!user) { setPhoto(null); return; } AsyncStorage.getItem(`ff:photo:${user.uid}`).then(v => setPhoto(v)).catch(() => undefined); }, [user]);
  const setPhotoUri = useCallback(async (uri: string | null) => {
    if (!user) return; setPhoto(uri);
    if (uri) await AsyncStorage.setItem(`ff:photo:${user.uid}`, uri); else await AsyncStorage.removeItem(`ff:photo:${user.uid}`);
  }, [user]);

  const updateSettings = useCallback(async (p: Partial<Settings>) => {
    if (!engine) return;
    await engine.upsert('settings', SETTINGS_ID, { ...settings, ...p });
  }, [engine, settings]);

  const cloud = !!fb && !!user && !user.uid.startsWith('local_');
  const badge: Ctx['badge'] = !cloud ? 'local' : !status.online ? 'offline' : status.syncing ? 'syncing' : 'online';
  const dark = settings.darkModeOverride === 2; // Project I is light-only (System = light); Dark is an explicit choice
  const value = useMemo(() => ({ auth, user, ready, engine, shares, settings, status, cloud, syncNow, updateSettings, photoUri, setPhotoUri, badge }), [auth, user, ready, engine, shares, settings, status, cloud, syncNow, updateSettings, photoUri, setPhotoUri, badge]);
  return <AppCtx.Provider value={value}><PaletteContext.Provider value={dark ? darkColors : colors}>{children}</PaletteContext.Provider></AppCtx.Provider>;
}

/** Live list of non-deleted records, re-read whenever the engine reports a change (local write, pull or real-time update). */
export function useCollection<C extends CollectionName>(coll: C): Array<SyncRecord<DataTypes[C]>> {
  const { engine } = useApp();
  const [items, setItems] = useState<Array<SyncRecord<DataTypes[C]>>>([]);
  useEffect(() => {
    if (!engine) { setItems([]); return; }
    let alive = true;
    const load = () => engine.list(coll).then(r => { if (alive) setItems(r); });
    void load();
    const off = engine.onChange(coll, load);
    return () => { alive = false; off(); };
  }, [engine, coll]);
  return items;
}
