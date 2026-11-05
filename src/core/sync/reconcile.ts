import { SyncMeta } from '../models';
import { compareHlc } from './hlc';

/**
 * CONFLICT RESOLUTION RULE (deterministic, per record):
 *
 *   The write with the greater HLC stamp wins. Tombstones are ordinary writes (deleted=true) and follow the
 *   same rule: a delete beats an older edit, and an edit made AFTER the delete (greater stamp) resurrects it.
 *   Equal stamps are the same write (idempotent re-delivery) and change nothing.
 *
 * Because the stamp is a total order that does not depend on arrival order, every device that sees the same set
 * of writes ends in the same state regardless of the order in which they sync (convergence).
 */
export type Winner = 'local' | 'remote' | 'same';

export function resolve(local: SyncMeta | undefined, remote: SyncMeta | undefined): Winner {
  if (!local && !remote) return 'same';
  if (!local) return 'remote';
  if (!remote) return 'local';
  const c = compareHlc(local.hlc, remote.hlc);
  return c > 0 ? 'local' : c < 0 ? 'remote' : 'same';
}
