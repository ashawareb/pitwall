import { projectHash } from '@pitwall/parser';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Resolve the ~/.claude/projects/<hash> directory for a given absolute path.
// The hashing algorithm itself lives in @pitwall/parser (spec 02); this helper
// just glues it to the Claude Code on-disk layout that the CLI depends on.

export function projectDirFor(absolutePath: string): string {
  return join(homedir(), '.claude', 'projects', projectHash(absolutePath));
}

export { projectHash };
