import { stat } from 'node:fs/promises';
import type { FileEditWarning, Session } from '@pitwall/parser';

export interface ReplayFile {
  path: string;
  content: string;
  lastEditedTMs: number;
}

export interface ReplaySnapshot {
  tMs: number;
  files: ReplayFile[];
}

type Slot = {
  mtimeMs: number;
  entries: Map<number, ReplaySnapshot>;
};

const SLOT_SIZE = 10;

// Per-session LRU memo for replay snapshots keyed by (filepath, tMs). Each
// slot is tied to the filesystem mtime; when mtime advances we drop the whole
// slot, matching the correctness invariant MtimeCache uses. Within a slot the
// Map's insertion order is the LRU order — on hit we reinsert; on overflow we
// drop the oldest key.
export class ReplayCache {
  private readonly slots: Map<string, Slot> = new Map();

  async getOrCompute(
    filepath: string,
    tMs: number,
    compute: () => ReplaySnapshot,
  ): Promise<ReplaySnapshot> {
    const st = await stat(filepath);
    const mtimeMs = st.mtimeMs;

    let slot = this.slots.get(filepath);
    if (slot && slot.mtimeMs !== mtimeMs) {
      this.slots.delete(filepath);
      slot = undefined;
    }
    if (!slot) {
      slot = { mtimeMs, entries: new Map() };
      this.slots.set(filepath, slot);
    }

    const hit = slot.entries.get(tMs);
    if (hit !== undefined) {
      slot.entries.delete(tMs);
      slot.entries.set(tMs, hit);
      return hit;
    }

    const value = compute();
    slot.entries.set(tMs, value);
    if (slot.entries.size > SLOT_SIZE) {
      const oldest = slot.entries.keys().next().value;
      if (oldest !== undefined) slot.entries.delete(oldest);
    }
    return value;
  }
}

function isBlocking(warnings: FileEditWarning[]): boolean {
  for (const w of warnings) {
    if (w.code === 'edit_miss' || w.code === 'multi_edit_partial_miss') {
      return true;
    }
  }
  return false;
}

// Pure snapshot builder. fileEdits arrive in chronological orderIndex order
// from reconstructSession; walk forward and overwrite per-path state until
// edit.tMs crosses the target. Edits whose underlying Edit/MultiEdit missed
// leave postContent = '' by construction, so we skip them — otherwise they
// would clobber the real state. line_ending_mismatch is diagnostic, not
// blocking, and we keep those.
export function computeReplay(
  session: Session,
  targetTMs: number,
): ReplaySnapshot {
  const state = new Map<string, { content: string; lastEditedTMs: number }>();
  for (const edit of session.fileEdits) {
    if (edit.tMs > targetTMs) break;
    if (isBlocking(edit.warnings)) continue;
    state.set(edit.path, {
      content: edit.postContent,
      lastEditedTMs: edit.tMs,
    });
  }
  const files = Array.from(state.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, { content, lastEditedTMs }]) => ({
      path,
      content,
      lastEditedTMs,
    }));
  return { tMs: targetTMs, files };
}
