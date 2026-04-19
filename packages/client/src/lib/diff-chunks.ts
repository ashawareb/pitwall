// Line-level diff chunker for the middle-panel DiffView.
//
// Produces a Segment[] that the renderer walks top-to-bottom:
//   - `chunk`   = contiguous add/del run, user-selectable
//   - `context` = unchanged lines shown inline (always visible)
//   - `hunk`    = unchanged lines hidden behind "… N unchanged lines …"
//
// Segmentation rules (docs/04-ui-system.md + spec 11 blueprint, CONTEXT=3):
//   eq-run before first chunk:   L ≤ 3          → all as context
//                                L > 3          → hunk(L−3) + context(3)
//   eq-run after last chunk:     L ≤ 3          → all as context
//                                L > 3          → context(3) + hunk(L−3)
//   eq-run between two chunks:   L ≤ 6          → all as context (3+3 would overlap)
//                                L > 6          → context(3) + hunk(L−6) + context(3)
//
// Line differencing itself comes from the `diff` package (diffLines) — we
// can't reuse @pitwall/parser's diff.ts because the parser emits counts
// only, and we need the full op stream. splitLines matches the parser's
// wc -l trailing-newline semantics so files with and without a trailing
// "\n" diff identically.

import { diffLines as diffLinesPkg } from 'diff';

export const CONTEXT_LINES = 3;

export type LineOp =
  | { readonly kind: 'eq'; readonly preLine: number; readonly postLine: number; readonly text: string }
  | { readonly kind: 'add'; readonly postLine: number; readonly text: string }
  | { readonly kind: 'del'; readonly preLine: number; readonly text: string };

export type Segment =
  | { readonly kind: 'context'; readonly lines: readonly LineOp[] }
  | { readonly kind: 'hunk'; readonly hiddenCount: number; readonly lines: readonly LineOp[] }
  | { readonly kind: 'chunk'; readonly id: string; readonly lines: readonly LineOp[] };

export function buildDiffSegments(
  preContent: string | null,
  postContent: string,
  filePath: string,
): Segment[] {
  // Failed edit (parser emits {preContent: null, postContent: ''} for
  // edit_miss / multi_edit_partial_miss) and the spec-11 "deleted file"
  // case share this shape — DiffView renders an empty-state note.
  if (preContent === null && postContent === '') return [];

  // New file — whole file is one all-add chunk, no hunks per spec 11 scope.
  if (preContent === null) {
    const lines = splitLines(postContent);
    if (lines.length === 0) return [];
    const addOps: LineOp[] = lines.map((text, i) => ({
      kind: 'add',
      postLine: i + 1,
      text,
    }));
    return [{ kind: 'chunk', id: chunkId(filePath, addOps), lines: addOps }];
  }

  const ops = diffToOps(preContent, postContent);
  return buildSegmentsFromOps(ops, filePath);
}

export function findFirstAddedChunkId(segments: readonly Segment[]): string | null {
  for (const seg of segments) {
    if (seg.kind !== 'chunk') continue;
    if (seg.lines.some((l) => l.kind === 'add')) return seg.id;
  }
  return null;
}

function splitLines(s: string): string[] {
  if (s.length === 0) return [];
  const parts = s.split('\n');
  // Drop the phantom trailing element when the input ended with "\n" — wc -l
  // semantics, mirrors @pitwall/parser/src/diff.ts so trailing-newline
  // variants of the same file diff identically.
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

// Adapts the `diff` package's line diff into our LineOp stream. Each Change
// from diffLines represents a contiguous add / del / eq run — we split its
// value on "\n" using the same wc -l rules as splitLines so a file that ends
// with "\n" and one that doesn't produce structurally identical ops.
function diffToOps(preContent: string, postContent: string): LineOp[] {
  const changes = diffLinesPkg(preContent, postContent);
  const ops: LineOp[] = [];
  let preLine = 0;
  let postLine = 0;
  for (const change of changes) {
    const texts = splitLines(change.value);
    if (change.added === true) {
      for (const text of texts) {
        postLine++;
        ops.push({ kind: 'add', postLine, text });
      }
    } else if (change.removed === true) {
      for (const text of texts) {
        preLine++;
        ops.push({ kind: 'del', preLine, text });
      }
    } else {
      for (const text of texts) {
        preLine++;
        postLine++;
        ops.push({ kind: 'eq', preLine, postLine, text });
      }
    }
  }
  return ops;
}

function buildSegmentsFromOps(ops: readonly LineOp[], filePath: string): Segment[] {
  if (ops.length === 0) return [];

  // Group ops into runs (eq vs change) keeping their order.
  interface Run {
    readonly kind: 'eq' | 'change';
    readonly ops: LineOp[];
  }
  const runs: Run[] = [];
  let current: LineOp[] = [];
  let currentKind: 'eq' | 'change' | null = null;
  for (const op of ops) {
    const k: 'eq' | 'change' = op.kind === 'eq' ? 'eq' : 'change';
    if (k !== currentKind) {
      if (current.length > 0 && currentKind !== null) {
        runs.push({ kind: currentKind, ops: current });
      }
      current = [];
      currentKind = k;
    }
    current.push(op);
  }
  if (current.length > 0 && currentKind !== null) {
    runs.push({ kind: currentKind, ops: current });
  }

  let firstChangeIdx = -1;
  let lastChangeIdx = -1;
  for (let r = 0; r < runs.length; r++) {
    if (runs[r]!.kind === 'change') {
      if (firstChangeIdx === -1) firstChangeIdx = r;
      lastChangeIdx = r;
    }
  }

  const segments: Segment[] = [];
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r]!;
    if (run.kind === 'change') {
      segments.push({
        kind: 'chunk',
        id: chunkId(filePath, run.ops),
        lines: run.ops,
      });
      continue;
    }

    // Defensive — parser never emits a pure-eq diff. Return [] so the
    // empty-state branch handles uniformly.
    if (firstChangeIdx === -1) return [];

    const L = run.ops.length;
    const isLeading = r < firstChangeIdx;
    const isTrailing = r > lastChangeIdx;

    if (isLeading) {
      if (L <= CONTEXT_LINES) {
        segments.push({ kind: 'context', lines: run.ops });
      } else {
        const hidden = L - CONTEXT_LINES;
        segments.push({
          kind: 'hunk',
          hiddenCount: hidden,
          lines: run.ops.slice(0, hidden),
        });
        segments.push({
          kind: 'context',
          lines: run.ops.slice(hidden),
        });
      }
    } else if (isTrailing) {
      if (L <= CONTEXT_LINES) {
        segments.push({ kind: 'context', lines: run.ops });
      } else {
        const hidden = L - CONTEXT_LINES;
        segments.push({
          kind: 'context',
          lines: run.ops.slice(0, CONTEXT_LINES),
        });
        segments.push({
          kind: 'hunk',
          hiddenCount: hidden,
          lines: run.ops.slice(CONTEXT_LINES),
        });
      }
    } else {
      // Between two chunks — 3+3 overlap at L=6 is why the threshold is 2*CONTEXT.
      if (L <= 2 * CONTEXT_LINES) {
        segments.push({ kind: 'context', lines: run.ops });
      } else {
        const hidden = L - 2 * CONTEXT_LINES;
        segments.push({
          kind: 'context',
          lines: run.ops.slice(0, CONTEXT_LINES),
        });
        segments.push({
          kind: 'hunk',
          hiddenCount: hidden,
          lines: run.ops.slice(CONTEXT_LINES, CONTEXT_LINES + hidden),
        });
        segments.push({
          kind: 'context',
          lines: run.ops.slice(CONTEXT_LINES + hidden),
        });
      }
    }
  }

  return segments;
}

function chunkId(filePath: string, ops: readonly LineOp[]): string {
  let firstPre: number | null = null;
  let firstPost: number | null = null;
  for (const op of ops) {
    if (firstPre === null && op.kind === 'del') firstPre = op.preLine;
    if (firstPost === null && op.kind === 'add') firstPost = op.postLine;
    if (firstPre !== null && firstPost !== null) break;
  }
  return `${filePath}:pre${firstPre ?? '-'}:post${firstPost ?? '-'}`;
}
