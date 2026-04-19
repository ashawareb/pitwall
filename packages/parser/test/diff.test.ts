import { describe, it, expect } from 'vitest';
import { countLineChanges } from '../src/diff.js';

describe('countLineChanges', () => {
  it('returns 0/0 for identical strings', () => {
    expect(countLineChanges('a\nb\nc', 'a\nb\nc')).toEqual({
      additions: 0,
      deletions: 0,
    });
  });

  it('counts pure additions when preContent is empty', () => {
    expect(countLineChanges('', 'one\ntwo\nthree')).toEqual({
      additions: 3,
      deletions: 0,
    });
  });

  it('counts pure deletions when postContent is empty', () => {
    expect(countLineChanges('one\ntwo\nthree', '')).toEqual({
      additions: 0,
      deletions: 3,
    });
  });

  it('counts a single-line change as 1 addition + 1 deletion', () => {
    const pre = 'line1\nline2\nline3\nline4\nline5';
    const post = 'line1\nline2\nCHANGED\nline4\nline5';
    expect(countLineChanges(pre, post)).toEqual({
      additions: 1,
      deletions: 1,
    });
  });

  it('counts interleaved add / delete / change correctly', () => {
    // pre:  [a, b, c, d, e]
    // post: [a, NEW, c, X, e, EXTRA]
    // LCS:  a, c, e → length 3
    // additions = 6 - 3 = 3; deletions = 5 - 3 = 2
    const pre = 'a\nb\nc\nd\ne';
    const post = 'a\nNEW\nc\nX\ne\nEXTRA';
    expect(countLineChanges(pre, post)).toEqual({
      additions: 3,
      deletions: 2,
    });
  });

  it('treats symmetric trailing newlines as no-op', () => {
    expect(countLineChanges('a\nb\n', 'a\nb\n')).toEqual({
      additions: 0,
      deletions: 0,
    });
  });

  it('normalizes an added trailing newline (no phantom line)', () => {
    expect(countLineChanges('a\nb', 'a\nb\n')).toEqual({
      additions: 0,
      deletions: 0,
    });
  });

  it('normalizes a removed trailing newline (no phantom line)', () => {
    expect(countLineChanges('a\nb\n', 'a\nb')).toEqual({
      additions: 0,
      deletions: 0,
    });
  });
});
