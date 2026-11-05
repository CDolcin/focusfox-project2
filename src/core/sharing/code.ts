import { Rng } from '../ids';

/** 31 symbols: no 0/O, 1/I/L look-alikes. 31^6 is about 887 million codes. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function generateShareCode(rng: Rng = Math.random): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return out;
}

/** Accepts what a person types: lowercase, spaces, dashes. Returns null when it cannot be a valid code. */
export function normalizeShareCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '');
  if (s.length !== CODE_LENGTH) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

/**
 * Pick an unused code. `exists` is the server check (in Firestore: a create-only transaction on sharedDecks/{code}).
 * Retries a bounded number of times; collisions are astronomically rare at this size.
 */
export async function allocateShareCode(exists: (code: string) => Promise<boolean>, rng: Rng = Math.random, maxTries = 8): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const code = generateShareCode(rng);
    if (!(await exists(code))) return code;
  }
  throw new Error('Could not allocate a unique share code');
}
