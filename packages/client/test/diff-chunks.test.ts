import { describe, expect, it } from 'vitest';
import {
  buildDiffSegments,
  findFirstAddedChunkId,
  type Segment,
} from '../src/lib/diff-chunks.js';

// Shared fixtures — using short joined strings so any segmentation bug prints
// a readable diff rather than a wall of escaped newlines.
const FP = 'app/models/user.rb';

function linesOf(seg: Segment): string[] {
  return seg.lines.map((l) => l.text);
}

function seg(segments: Segment[], i: number): Segment {
  const s = segments[i];
  if (!s) throw new Error(`no segment at index ${i}`);
  return s;
}

describe('buildDiffSegments', () => {
  it('returns a single add chunk for a one-line addition at the start of the file', () => {
    const pre = 'a\nb\nc\n';
    const post = 'NEW\na\nb\nc\n';
    const segments = buildDiffSegments(pre, post, FP);

    // [chunk(NEW), context(a,b,c)] — leading eq-run L=0 produces no context;
    // trailing eq-run L=3 ≤ CONTEXT_LINES so all stays as context.
    expect(segments.map((s) => s.kind)).toEqual(['chunk', 'context']);
    expect(linesOf(seg(segments, 0))).toEqual(['NEW']);
    expect(linesOf(seg(segments, 1))).toEqual(['a', 'b', 'c']);
  });

  it('returns a single del chunk for a one-line deletion at the end of the file', () => {
    const pre = 'a\nb\nc\nOLD\n';
    const post = 'a\nb\nc\n';
    const segments = buildDiffSegments(pre, post, FP);

    expect(segments.map((s) => s.kind)).toEqual(['context', 'chunk']);
    expect(linesOf(seg(segments, 0))).toEqual(['a', 'b', 'c']);
    expect(linesOf(seg(segments, 1))).toEqual(['OLD']);
  });

  it('merges an adjacent add+del run into one mixed chunk', () => {
    const pre = 'alpha\nbeta\ngamma\n';
    const post = 'alpha\nBETA\ngamma\n';
    const segments = buildDiffSegments(pre, post, FP);

    expect(segments.map((s) => s.kind)).toEqual(['context', 'chunk', 'context']);
    const change = seg(segments, 1);
    expect(change.lines.map((l) => l.kind).sort()).toEqual(['add', 'del']);
  });

  it('keeps a 5-line eq-run between two chunks fully as context (≤ 2*CONTEXT)', () => {
    // Between-chunks threshold is 2*CONTEXT=6; L=5 collapses to a single context.
    const pre = 'X\na\nb\nc\nd\ne\nY\n';
    const post = 'X1\na\nb\nc\nd\ne\nY1\n';
    const segments = buildDiffSegments(pre, post, FP);

    expect(segments.map((s) => s.kind)).toEqual(['chunk', 'context', 'chunk']);
    expect(linesOf(seg(segments, 1))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('splits an 8-line eq-run between two chunks into context(3) + hunk(2) + context(3)', () => {
    const pre = 'X\na\nb\nc\nd\ne\nf\ng\nh\nY\n';
    const post = 'X1\na\nb\nc\nd\ne\nf\ng\nh\nY1\n';
    const segments = buildDiffSegments(pre, post, FP);

    expect(segments.map((s) => s.kind)).toEqual([
      'chunk',
      'context',
      'hunk',
      'context',
      'chunk',
    ]);
    expect(linesOf(seg(segments, 1))).toEqual(['a', 'b', 'c']);
    const hunk = seg(segments, 2);
    if (hunk.kind !== 'hunk') throw new Error('expected hunk');
    expect(hunk.hiddenCount).toBe(2);
    expect(linesOf(hunk)).toEqual(['d', 'e']);
    expect(linesOf(seg(segments, 3))).toEqual(['f', 'g', 'h']);
  });

  it('emits no leading segment for a chunk at the very start of the file', () => {
    const pre = 'a\nb\nc\n';
    const post = 'NEW\na\nb\nc\n';
    const segments = buildDiffSegments(pre, post, FP);
    expect(seg(segments, 0).kind).toBe('chunk');
  });

  it('emits no trailing segment for a chunk at the very end of the file', () => {
    const pre = 'a\nb\nc\n';
    const post = 'a\nb\nc\nNEW\n';
    const segments = buildDiffSegments(pre, post, FP);
    expect(seg(segments, segments.length - 1).kind).toBe('chunk');
  });

  it('collapses long leading and trailing eq-runs into hunks with 3 lines of surrounding context', () => {
    // Distinct lead/trail contents so the LCS cannot collapse the two halves
    // onto the same anchor and leave a single unbalanced chunk.
    const leadLines = ['La', 'Lb', 'Lc', 'Ld', 'Le', 'Lf', 'Lg', 'Lh', 'Li', 'Lj'];
    const trailLines = ['Ta', 'Tb', 'Tc', 'Td', 'Te', 'Tf', 'Tg', 'Th', 'Ti', 'Tj'];
    const pre = [...leadLines, ...trailLines].join('\n') + '\n';
    const post = [...leadLines, 'NEW', ...trailLines].join('\n') + '\n';
    const segments = buildDiffSegments(pre, post, FP);

    expect(segments.map((s) => s.kind)).toEqual([
      'hunk',
      'context',
      'chunk',
      'context',
      'hunk',
    ]);

    const lead = seg(segments, 0);
    if (lead.kind !== 'hunk') throw new Error('expected hunk');
    expect(lead.hiddenCount).toBe(7);
    expect(linesOf(lead)).toEqual(['La', 'Lb', 'Lc', 'Ld', 'Le', 'Lf', 'Lg']);

    expect(linesOf(seg(segments, 1))).toEqual(['Lh', 'Li', 'Lj']);
    expect(linesOf(seg(segments, 2))).toEqual(['NEW']);
    expect(linesOf(seg(segments, 3))).toEqual(['Ta', 'Tb', 'Tc']);

    const trail = seg(segments, 4);
    if (trail.kind !== 'hunk') throw new Error('expected hunk');
    expect(trail.hiddenCount).toBe(7);
    expect(linesOf(trail)).toEqual(['Td', 'Te', 'Tf', 'Tg', 'Th', 'Ti', 'Tj']);
  });

  it('treats a new file (preContent=null, non-empty post) as a single all-add chunk with no hunks', () => {
    const post = 'line1\nline2\nline3\nline4\nline5\n';
    const segments = buildDiffSegments(null, post, FP);

    expect(segments.length).toBe(1);
    const only = seg(segments, 0);
    expect(only.kind).toBe('chunk');
    expect(only.lines.every((l) => l.kind === 'add')).toBe(true);
    expect(linesOf(only)).toEqual(['line1', 'line2', 'line3', 'line4', 'line5']);
  });

  it('returns [] for a failed edit marker (preContent=null, postContent="")', () => {
    expect(buildDiffSegments(null, '', FP)).toEqual([]);
  });

  it('returns [] for identical files', () => {
    // Not a realistic parser emission, but the renderer must not throw.
    expect(buildDiffSegments('same\n', 'same\n', FP)).toEqual([]);
  });

  it('produces identical segment structure for files with and without a trailing newline', () => {
    // Lock 4: splitLines must match parser's wc -l semantics so both variants
    // diff to the same ops.
    const preA = 'a\nb\nc\n';
    const postA = 'a\nB\nc\n';
    const preB = 'a\nb\nc'; // no trailing \n
    const postB = 'a\nB\nc';

    const a = buildDiffSegments(preA, postA, FP);
    const b = buildDiffSegments(preB, postB, FP);

    expect(a.map((s) => s.kind)).toEqual(b.map((s) => s.kind));
    a.forEach((segA, i) => {
      expect(linesOf(segA)).toEqual(linesOf(seg(b, i)));
    });
  });

  it('emits chunk ids derived from file path and first change lines', () => {
    const pre = 'keep\na\nb\nc\n';
    const post = 'keep\nA\nb\nc\n';
    const [, chunk] = buildDiffSegments(pre, post, FP);
    if (!chunk || chunk.kind !== 'chunk') throw new Error('expected chunk');
    expect(chunk.id).toBe(`${FP}:pre2:post2`);
  });

  it('gives chunk ids that are stable across rebuilds of the same diff', () => {
    const pre = 'a\nb\nc\n';
    const post = 'a\nB\nc\n';
    const first = buildDiffSegments(pre, post, FP).filter(
      (s) => s.kind === 'chunk',
    );
    const second = buildDiffSegments(pre, post, FP).filter(
      (s) => s.kind === 'chunk',
    );
    expect(first.map((s) => s.kind === 'chunk' && s.id)).toEqual(
      second.map((s) => s.kind === 'chunk' && s.id),
    );
  });
});

describe('findFirstAddedChunkId', () => {
  it('returns the id of the first chunk that contains an add op', () => {
    // Pre: two chunks — first is a pure deletion, second mixes add+del. The
    // cursor should skip to the second.
    const pre = 'OLD\na\nb\nc\nd\ne\nf\ng\nh\ni\nkeep\n';
    const post = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nNEW\n';
    const segments = buildDiffSegments(pre, post, FP);
    const id = findFirstAddedChunkId(segments);
    expect(id).not.toBeNull();
    expect(id).toContain('post');
  });

  it('returns null when there are no added chunks at all', () => {
    // Pure deletion diff → no chunk has an add op.
    const pre = 'a\nb\nc\n';
    const post = 'a\nb\n';
    const segments = buildDiffSegments(pre, post, FP);
    expect(findFirstAddedChunkId(segments)).toBeNull();
  });

  it('returns null on an empty segment list', () => {
    expect(findFirstAddedChunkId([])).toBeNull();
  });
});
