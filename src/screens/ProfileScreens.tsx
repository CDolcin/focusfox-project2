import React, { useEffect, useState } from 'react';
import { Alert, Image, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp, useCollection } from '../app/AppContext';
import { exportNotesPdf, exportTasksPdf } from '../services/exporter';
import { notificationsAvailable } from '../services/notifications';
import { BackableHeader, Choice, Dialog, InitialsAvatar, OnlineBadge, OutlinedField, OutlinedPill, Panel, PrimaryButton, Row, Screen, ScreenHeader, SettingsRow, T, useColors } from '../ui/kit';

export function ProfileAvatar({ size = 56 }: { size?: number }) {
  const { user, photoUri } = useApp();
  if (photoUri) return <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel="Profile photo" />;
  return <InitialsAvatar name={user?.displayName ?? '?'} size={size} />;
}

export function ProfileScreen({ go, onSignedOut }: { go: (r: string) => void; onSignedOut: () => void }) {
  const { user, auth, badge } = useApp(); const c = useColors();
  const [confirm, setConfirm] = useState(false);
  return (
    <Screen>
      <ScreenHeader title="Profile" subtitle="Your FocusFox preferences" />
      <View style={{ height: 16 }} />
      <Panel radius={16} onPress={() => go('EditProfile')} style={{ padding: 18, flexDirection: 'row', alignItems: 'center' }}>
        <ProfileAvatar />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontWeight: '700', fontSize: 18, color: c.text }}>{user?.displayName}</Text>
          <T kind="bodyDim">{user?.isGuest ? 'Guest' : 'Student'} · FocusFox member</T>
          <View style={{ height: 6 }} /><OnlineBadge state={badge} />
        </View>
        <Text style={{ color: c.purple, fontWeight: '600' }}>Edit</Text>
      </Panel>
      <View style={{ height: 20 }} />
      <View style={{ gap: 12 }}>
        <SettingsRow icon="schedule" title="Study preferences" subtitle="Pomodoro, reminders" onPress={() => go('StudyPrefs')} />
        <SettingsRow icon="cloud" title="Sync & account" subtitle="Cloud backup, offline mode" onPress={() => go('SyncAccount')} />
        <SettingsRow icon="notifications" title="Notifications" subtitle="Study reminders, streaks" onPress={() => go('NotificationsSettings')} />
        <SettingsRow icon="settings" title="Settings" subtitle="Appearance, privacy" onPress={() => go('AppSettings')} />
        <SettingsRow icon="lock" title="Sign Out" subtitle="Sign out from class" onPress={() => setConfirm(true)} />
      </View>
      <T kind="bodyDim" style={{ alignSelf: 'center', marginTop: 40 }}>FocusFox v2.0 · CTE308 Project-II</T>
      <Dialog visible={confirm} title="Sign out?" onDismiss={() => setConfirm(false)} confirmLabel="Sign Out" onConfirm={async () => { setConfirm(false); await auth.signOut(); onSignedOut(); }}>
        <Text style={{ color: c.text, fontSize: 15 }}>You can sign back in anytime. Changes that haven't synced yet stay on this phone.</Text>
      </Dialog>
    </Screen>
  );
}

export function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const { photoUri, setPhotoUri, user, auth } = useApp();
  const [name, setName] = useState(user?.displayName ?? '');
  const choose = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photos permission needed', 'Allow photo access to choose a profile photo.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled) await setPhotoUri(r.assets[0].uri);
  };
  return (
    <Screen>
      <BackableHeader title="Edit profile" subtitle="Change your photo" onBack={onBack} />
      <View style={{ height: 24 }} />
      <View style={{ alignItems: 'center' }}><ProfileAvatar size={120} /></View>
      <View style={{ height: 20 }} />
      <PrimaryButton title="Choose a new photo" onPress={choose} />
      {photoUri ? <><View style={{ height: 12 }} /><OutlinedPill title="Remove photo" onPress={() => setPhotoUri(null)} /></> : null}
      <View style={{ height: 20 }} />
      {!user?.isGuest && <><OutlinedField label="Display name" value={name} onChangeText={setName} /><View style={{ height: 12 }} /><PrimaryButton title="Save name" disabled={!name.trim() || name.trim() === user?.displayName} onPress={async () => { await auth.updateName(name); onBack(); }} /><View style={{ height: 16 }} /></>}
      <T kind="bodyDim">Your photo is stored locally on this device and shown across your profile.</T>
    </Screen>
  );
}

export function StudyPreferencesScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useApp();
  const [f, setF] = useState(`${settings.focusMinutes}`); const [b, setB] = useState(`${settings.breakMinutes}`); const [s, setS] = useState(`${settings.sessionsGoal}`);
  useEffect(() => { setF(`${settings.focusMinutes}`); setB(`${settings.breakMinutes}`); setS(`${settings.sessionsGoal}`); }, [settings.focusMinutes, settings.breakMinutes, settings.sessionsGoal]);
  const num = (v: string) => v.replace(/\D/g, '');
  const clamp = (v: string, lo: number, hi: number, d: number) => Math.min(hi, Math.max(lo, parseInt(v, 10) || d));
  return (
    <Screen>
      <BackableHeader title="Study preferences" subtitle="Your default Pomodoro settings" onBack={onBack} />
      <View style={{ height: 20 }} />
      <OutlinedField label="Default focus length (minutes)" keyboardType="number-pad" value={f} onChangeText={v => setF(num(v))} />
      <View style={{ height: 14 }} />
      <OutlinedField label="Default break length (minutes)" keyboardType="number-pad" value={b} onChangeText={v => setB(num(v))} />
      <View style={{ height: 14 }} />
      <OutlinedField label="Sessions per cycle" keyboardType="number-pad" value={s} onChangeText={v => setS(num(v))} />
      <View style={{ height: 24 }} />
      <PrimaryButton title="Save preferences" onPress={async () => { await updateSettings({ focusMinutes: clamp(f, 1, 180, settings.focusMinutes), breakMinutes: clamp(b, 1, 60, settings.breakMinutes), sessionsGoal: clamp(s, 1, 12, settings.sessionsGoal) }); onBack(); }} />
      <View style={{ height: 12 }} />
      <T kind="bodyDim">These become the default whenever you start a new Focus session — you can still override them per-session from the Focus tab.</T>
    </Screen>
  );
}

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useApp(); const c = useColors();
  return (
    <Screen>
      <BackableHeader title="Notifications" subtitle="Study reminders, streaks" onBack={onBack} />
      <View style={{ height: 16 }} />
      <Panel radius={16} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontWeight: '600', fontSize: 16, color: c.text }}>Study reminders & streaks</Text>
          <T kind="bodyDim">Get nudged about upcoming task deadlines and when your focus timer ends.</T>
        </View>
        <Switch value={settings.notificationsEnabled} onValueChange={v => updateSettings({ notificationsEnabled: v })} trackColor={{ true: c.purple }} />
      </Panel>
      <View style={{ height: 16 }} />
      <T kind="bodyDim">{notificationsAvailable() ? 'Reminders are delivered as local notifications on this phone.' : 'Notifications are not available in Expo Go on this phone, so reminders are skipped here. They work in a development build (npx expo run:android / run:ios).'}</T>
    </Screen>
  );
}

export function AppSettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings } = useApp();
  return (
    <Screen>
      <BackableHeader title="Settings" subtitle="Appearance & privacy" onBack={onBack} />
      <View style={{ height: 20 }} />
      <T kind="titleLarge">Appearance</T>
      <View style={{ height: 10 }} />
      <Row style={{ gap: 10 }}>
        {(['System', 'Light', 'Dark'] as const).map((l, i) => <Choice key={l} label={l} selected={settings.darkModeOverride === i} variant="soft" onPress={() => updateSettings({ darkModeOverride: i as 0 | 1 | 2 })} />)}
      </Row>
      <View style={{ height: 28 }} />
      <T kind="titleLarge">Privacy</T>
      <View style={{ height: 10 }} />
      <T kind="bodyDim">Your camera is only ever active while you're on the Music performance screen, and only to detect hand gestures on your device — no video is uploaded anywhere. Your microphone is only active while recording a performance.</T>
      <View style={{ height: 12 }} />
      <T kind="bodyDim">Your tasks, notes, flashcards and recordings are stored on this phone first. When you are signed in with an account they are also backed up to your private cloud space so you can restore them on a new phone. Guest Mode never leaves this phone.</T>
    </Screen>
  );
}

export function SyncAccountScreen({ onBack }: { onBack: () => void }) {
  const { status, syncNow, cloud, badge, engine } = useApp(); const c = useColors();
  const tasks = useCollection('tasks'); const notes = useCollection('notes'); const cards = useCollection('cards'); const decks = useCollection('decks'); const sessions = useCollection('sessions'); const flowers = useCollection('flowers');
  const stat = (label: string, n: number) => <Row key={label} style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, justifyContent: 'space-between' }}><T>{label}</T><T kind="label" style={{ fontSize: 16 }}>{n}</T></Row>;
  const fail = (e: unknown) => Alert.alert('Export failed', (e as Error)?.message ?? String(e));
  return (
    <Screen>
      <BackableHeader title="Sync & account" subtitle="Where your data lives" onBack={onBack} />
      <View style={{ height: 16 }} />
      <OnlineBadge state={badge} />
      <View style={{ height: 16 }} />
      <T kind="bodyDim">{cloud
        ? 'Everything is saved on this phone first, so FocusFox works without internet. Changes sync to your account in the background and appear on your other phones; if two phones edit the same item, the most recent edit wins.'
        : 'This account is stored only on this phone, in a local database — nothing syncs between devices. Everything works without an internet connection. Sign in with an email account (with Firebase configured) to back up and restore on a new phone.'}</T>
      {cloud && (
        <>
          <View style={{ height: 14 }} />
          <T kind="bodyDim">{status.pending} change{status.pending === 1 ? '' : 's'} waiting{status.dead ? ` · ${status.dead} could not be sent` : ''}{status.lastSyncAt ? ` · last sync ${new Date(status.lastSyncAt).toLocaleTimeString()}` : ''}</T>
          {status.error ? <T kind="bodyDim" style={{ color: c.danger }}>{status.error}</T> : null}
          <View style={{ height: 10 }} />
          <Row style={{ gap: 10 }}>
            <PrimaryButton title={status.syncing ? 'Syncing…' : 'Sync now'} onPress={syncNow} disabled={status.syncing} style={{ height: 44, paddingHorizontal: 22 }} />
            {status.dead ? <OutlinedPill title="Retry failed" onPress={async () => { await engine?.retryDead(); await syncNow(); }} /> : null}
          </Row>
        </>
      )}
      <View style={{ height: 20 }} />
      <T kind="titleLarge">What's stored on this device</T>
      <View style={{ height: 10 }} />
      <View style={{ gap: 10 }}>{stat('Tasks', tasks.length)}{stat('Notes', notes.length)}{stat('Flashcard decks', decks.length)}{stat('Flashcards', cards.length)}{stat('Focus sessions', sessions.length)}{stat('Flowers', flowers.length)}</View>
      <View style={{ height: 20 }} />
      <T kind="titleLarge">Export</T>
      <View style={{ height: 10 }} />
      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <OutlinedPill title="Tasks → PDF" onPress={() => exportTasksPdf(tasks).catch(fail)} />
        <OutlinedPill title="Notes → PDF" onPress={() => exportNotesPdf(notes).catch(fail)} />
      </Row>
      <T kind="bodyDim" style={{ marginTop: 8 }}>Flashcard decks are exported from Manage Flashcards → Export file.</T>
    </Screen>
  );
}
