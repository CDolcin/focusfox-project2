import { Platform } from 'react-native';
import { Task } from '../core/models';

type NotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications is loaded lazily and defensively: some Expo Go builds (notably Android) do not ship all of its
 * native modules, and importing it at start-up would crash the whole app. If it cannot load, reminders silently
 * become no-ops and everything else keeps working. Development builds (npx expo run:android / run:ios) include it.
 */
let mod: NotificationsModule | null | undefined;
function N(): NotificationsModule | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-notifications') as NotificationsModule;
    m.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    mod = m;
  } catch { mod = null; }
  return mod;
}
export const notificationsAvailable = () => N() !== null;

export async function ensureNotificationPermission(): Promise<boolean> {
  const n = N(); if (!n) return false;
  try {
    const cur = await n.getPermissionsAsync();
    if (cur.granted) return true;
    if (Platform.OS === 'android') await n.setNotificationChannelAsync('default', { name: 'Reminders', importance: n.AndroidImportance.HIGH });
    return (await n.requestPermissionsAsync()).granted;
  } catch { return false; }
}

const at = (n: NotificationsModule, date: Date) => ({ type: n.SchedulableTriggerInputTypes.DATE, date }) as const;

export async function cancelByKey(key: string) {
  try { await N()?.cancelScheduledNotificationAsync(key); } catch { /* nothing scheduled */ }
}

/** Local notification for a task deadline reminder (`reminderMinutesBefore` before the deadline). */
export async function scheduleTaskReminder(id: string, t: Pick<Task, 'title' | 'deadlineMs' | 'reminderMinutesBefore'>): Promise<string | null> {
  const n = N(); const when = t.deadlineMs - t.reminderMinutesBefore * 60_000;
  if (!n || when <= Date.now() || !(await ensureNotificationPermission())) return null;
  try {
    await cancelByKey(`task:${id}`);
    return await n.scheduleNotificationAsync({ identifier: `task:${id}`, content: { title: 'Task due soon', body: t.title, data: { taskId: id } }, trigger: at(n, new Date(when)) });
  } catch { return null; }
}

/** Fires when the focus timer is due, even if the app is in the background. */
export async function scheduleTimerEnd(label: string, endsAtMs: number, isBreak: boolean) {
  const n = N(); if (!n || !(await ensureNotificationPermission())) return;
  try {
    await cancelByKey('timer');
    await n.scheduleNotificationAsync({ identifier: 'timer', content: { title: isBreak ? 'Break over' : 'Focus session complete', body: isBreak ? 'Ready for the next round?' : `Nice work on ${label || 'your session'}. A flower has grown.` }, trigger: at(n, new Date(endsAtMs)) });
  } catch { /* reminders are best-effort */ }
}
