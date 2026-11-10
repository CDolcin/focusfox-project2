import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase';
import { generateShareCode, normalizeShareCode } from '../core/sharing/code';
import { FriendProfile } from '../core/friends/ranking';

export async function readFriend(input: string): Promise<FriendProfile | null> {
  const code = normalizeShareCode(input); if (!code) throw new Error('Enter a valid six-character friend code.');
  const fb = getFirebase(); if (!fb) throw new Error('Cloud sign-in is required.');
  const snap = await getDoc(doc(fb.db, 'friendProfiles', code));
  return snap.exists() ? snap.data() as FriendProfile : null;
}
/** Atomic code claim; a deterministic private index restores the same code on every phone. */
export async function publishFriend(uid: string, name: string, streak: number, day: string): Promise<string> {
  const fb = getFirebase(); if (!fb) throw new Error('Cloud sign-in is required.');
  const index = doc(fb.db, 'friendOwners', uid);
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateShareCode();
    const code = await runTransaction(fb.db, async tx => {
      const owner = await tx.get(index);
      const chosen = owner.exists() ? owner.data().code as string : candidate;
      const ref = doc(fb.db, 'friendProfiles', chosen); const profile = await tx.get(ref);
      if (profile.exists() && profile.data().uid !== uid) return null;
      tx.set(index, { code: chosen });
      tx.set(ref, { uid, code: chosen, name: name.slice(0, 60), streak, day, updatedAtMs: Date.now(), serverUpdatedAt: serverTimestamp() });
      return chosen;
    });
    if (code) return code;
  }
  throw new Error('Could not create a friend code. Try again.');
}
