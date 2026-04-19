import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAUDE_DIR_NAME = '.claude';
const PROJECTS_SUBDIR = 'projects';

// Single source of truth for resolving ~/.claude. Read at request time so tests
// can inject via vi.stubEnv without restarting the server, and so production
// users who flip the env var between runs pick it up on next request. Callers
// pass the returned string into getProjectsDir — do not re-read process.env
// from route handlers.
export function resolveClaudeHome(): string {
  const override = process.env.PITWALL_CLAUDE_HOME;
  if (override !== undefined && override.length > 0) return override;
  return join(homedir(), CLAUDE_DIR_NAME);
}

export function getProjectsDir(claudeHome: string): string {
  return join(claudeHome, PROJECTS_SUBDIR);
}
