export interface FriendProfile { uid: string; code: string; name: string; streak: number; day: string; updatedAtMs: number }
/** A profile not refreshed on the current local day cannot claim a current streak. */
export function rankFriends(profiles: FriendProfile[], today: string) {
  return profiles.map(p => ({ ...p, streak: p.day === today ? p.streak : 0, stale: p.day !== today }))
    .sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
}
