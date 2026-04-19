// Claude Code's on-disk hash for project directories under ~/.claude/projects/:
// both '/' and '.' collapse to '-'. Verified against the live directory
// listing on this machine — e.g. /Users/me/code/pitwall maps to
// -Users-me-code-pitwall, and /Users/me/code/myapp/.claude/worktrees/feature-branch
// maps to -Users-me-code-myapp--claude-worktrees-feature-branch.
// Existing dashes and underscores in path segments are preserved as-is.
// Keep this helper byte-identical with Claude Code so the CLI (spec 15) can
// resolve the same folder without a parallel algorithm.

export function projectHash(absolutePath: string): string {
  return absolutePath.replace(/[./]/g, '-');
}
