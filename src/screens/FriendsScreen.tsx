import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { useApp, useCollection } from '../app/AppContext';
import { currentStreak, dayKey } from '../core/focus/streak';
import { FriendProfile, rankFriends } from '../core/friends/ranking';
import { normalizeShareCode } from '../core/sharing/code';
import { publishFriend, readFriend } from '../services/friends';
import { BackableHeader, OutlinedField, OutlinedPill, Panel, PrimaryButton, Screen, T } from '../ui/kit';
export function FriendsScreen({ onBack }: { onBack(): void }) {
  const { user, cloud, status, settings, updateSettings } = useApp();
  const sessions = useCollection('sessions'); const [input, setInput] = useState('');
  const [profiles, setProfiles] = useState<FriendProfile[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!cloud || !user || !status.online) return;
    setBusy(true); setError('');
    try {
      const today = dayKey(Date.now(), new Date().getTimezoneOffset());
      const code = await publishFriend(user.uid, user.displayName || 'Student', currentStreak(sessions, Date.now(), new Date().getTimezoneOffset()), today);
      if (settings.friendCode !== code) await updateSettings({ friendCode: code });
      const rows = await Promise.all([code, ...(settings.friendCodes ?? [])].map(readFriend));
      setProfiles(rows.filter((p): p is FriendProfile => !!p));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, [cloud, user, status.online, sessions, settings.friendCode, settings.friendCodes, updateSettings]);
  useEffect(() => { void refresh(); }, [refresh]);
  const add = async () => {
    try {
      const code = normalizeShareCode(input); if (!code) throw new Error('Enter a valid six-character code.');
      if (code === settings.friendCode) throw new Error('This is your own code.');
      if ((settings.friendCodes ?? []).length >= 30) throw new Error('You can add up to 30 friends.');
      if (!await readFriend(code)) throw new Error('No friend found with this code.');
      await updateSettings({ friendCodes: [...new Set([...(settings.friendCodes ?? []), code])] }); setInput('');
    } catch (e) { Alert.alert('Add friend', (e as Error).message); }
  };
  return <Screen><BackableHeader title="Friends leaderboard" subtitle="Build your study streak together" onBack={onBack} />
    {!cloud ? <T>Sign in to a configured cloud account to add friends.</T> : <>
      <Panel style={{ padding: 16, marginTop: 16 }}><T kind="label">Your code: {settings.friendCode ?? 'Not created yet'}</T><T kind="bodyDim">Your name and self-reported streak are visible to signed-in people who have this code. Friends refresh when they open this screen.</T></Panel>
      {settings.friendCode && <OutlinedPill title="Share my friend code" onPress={() => Share.share({ message: `Add me on FocusFox: ${settings.friendCode}` })} />}
      <OutlinedField label="Friend code" value={input} onChangeText={setInput} autoCapitalize="characters" maxLength={6} />
      <PrimaryButton title="Add friend" disabled={busy || !status.online} onPress={add} />
      <View style={{ height: 12 }} /><OutlinedPill title={busy ? 'Refreshing…' : 'Refresh rankings'} onPress={() => { if (!busy) void refresh(); }} />
      {!status.online && <T kind="bodyDim">Offline — reconnect to refresh friends.</T>}{error ? <T>{error}</T> : null}
      {rankFriends(profiles, dayKey(Date.now(), new Date().getTimezoneOffset())).map((p, i) => <Panel key={p.code} style={{ padding: 16, marginTop: 10 }}><T kind="label">{i + 1}. {p.name}{p.uid === user?.uid ? ' (you)' : ''} · {p.streak} day streak</T>{p.stale && <T kind="bodyDim">Awaiting today's update</T>}{p.uid !== user?.uid && <OutlinedPill title="Remove friend" onPress={() => updateSettings({ friendCodes: (settings.friendCodes ?? []).filter(c => c !== p.code) })} />}</Panel>)}
    </>}
  </Screen>;
}
