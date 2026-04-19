import { describe, it, expect } from 'vitest';
import { projectHash } from '../src/index.js';

describe('projectHash', () => {
  it('replaces slashes with dashes', () => {
    expect(projectHash('/Users/foo/bar')).toBe('-Users-foo-bar');
  });

  it('replaces dots with dashes inside path segments', () => {
    // Matches the real ~/.claude/projects/ entry for /Users/me/code/pitwall
    // on the machine this repo was built on.
    expect(projectHash('/Users/me/code/pitwall')).toBe(
      '-Users-me-code-pitwall',
    );
  });

  it('collapses /. to -- when a dot-prefixed directory is in the path', () => {
    // Matches the real entry for a worktree under /.claude/:
    //   -Users-me-code-myapp--claude-worktrees-feature-branch
    expect(
      projectHash(
        '/Users/me/code/myapp/.claude/worktrees/feature-branch',
      ),
    ).toBe(
      '-Users-me-code-myapp--claude-worktrees-feature-branch',
    );
  });

  it('preserves existing dashes and underscores in path segments', () => {
    expect(projectHash('/a/foo-bar/baz_qux')).toBe('-a-foo-bar-baz_qux');
  });
});
