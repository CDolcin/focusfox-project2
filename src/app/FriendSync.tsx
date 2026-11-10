import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useApp, useCollection } from './AppContext';
import { currentStreak, dayKey } from '../core/focus/streak';
import { publishFriend } from '../services/friends';
/** Publish only after a user opts in by creating a friend code. Never publish private study data. */
export function FriendSync() {
  const { user, cloud, status, settings } = useApp(); const sessions = useCollection('sessions');
  const published = useRef('');
  useEffect(() => {
    if (!cloud || !user || !status.online || !settings.friendCode) return;
    let cancelled = false;
    const publish = async () => {
      const now = Date.now(), tz = new Date().getTimezoneOffset();
      const day = dayKey(now, tz), streak = currentStreak(sessions, now, tz);
      const key = `${user.uid}:${user.displayName}:${day}:${streak}`;
      if (published.current === key) return;
      try { await publishFriend(user.uid, user.displayName || 'Student', streak, day); if (!cancelled) published.current = key; }
      catch { /* Retry on foreground/reconnect/minute tick; offline study never depends on social publishing. */ }
    };
    void publish(); const timer = setInterval(() => void publish(), 60_000);
    const listener = AppState.addEventListener('change', s => { if (s === 'active') void publish(); });
    return () => { cancelled = true; clearInterval(timer); listener.remove(); };
  }, [cloud, user, status.online, settings.friendCode, sessions]);
  return null;
}
