import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { projectDirFor } from '../src/project-hash.js';

describe('projectDirFor', () => {
  it('maps /Users/x/foo to ~/.claude/projects/-Users-x-foo', () => {
    expect(projectDirFor('/Users/x/foo')).toBe(
      join(homedir(), '.claude', 'projects', '-Users-x-foo'),
    );
  });

  it('preserves existing dashes and replaces dots', () => {
    expect(projectDirFor('/Users/x/my.app-v2')).toBe(
      join(homedir(), '.claude', 'projects', '-Users-x-my-app-v2'),
    );
  });

  it('handles deep paths', () => {
    expect(projectDirFor('/Users/a/b/c/d')).toBe(
      join(homedir(), '.claude', 'projects', '-Users-a-b-c-d'),
    );
  });
});
