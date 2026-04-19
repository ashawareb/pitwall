import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { MtimeCache } from '../cache.js';
import { getProjectsDir, resolveClaudeHome } from '../fs/claude-home.js';
import {
  discoverProjects,
  type SessionMetadata,
} from '../fs/discover.js';

export interface WarnState {
  warnedHomeMissing: boolean;
}

export async function registerProjectsRoute(
  app: FastifyInstance,
  cache: MtimeCache<SessionMetadata>,
  warnState: WarnState,
): Promise<void> {
  app.get('/api/projects', async () => {
    const claudeHome = resolveClaudeHome();
    const projectsDir = getProjectsDir(claudeHome);

    const projects = await discoverProjects(projectsDir, cache, (msg, err) => {
      app.log.warn({ err }, msg);
    });

    await maybeWarnHomeMissing(app, warnState, projectsDir);

    return {
      projects: projects.map((p) => ({
        hash: p.hash,
        path: p.path,
        pathSource: p.pathSource,
        sessionCount: p.sessionFiles.length,
        lastActivityAt: p.lastActivityAt,
      })),
    };
  });
}

// Warn once per server instance when the env var is set but points at a
// missing directory. Gated on env-var-set so fresh installs (no Claude Code
// yet, so default ~/.claude/projects missing) do not get a spurious warning.
async function maybeWarnHomeMissing(
  app: FastifyInstance,
  state: WarnState,
  projectsDir: string,
): Promise<void> {
  if (state.warnedHomeMissing) return;
  const override = process.env.PITWALL_CLAUDE_HOME;
  if (override === undefined || override.length === 0) return;
  try {
    await stat(projectsDir);
  } catch {
    state.warnedHomeMissing = true;
    app.log.warn(
      `PITWALL_CLAUDE_HOME is set to ${override} but ${projectsDir} does not exist; returning empty project list.`,
    );
  }
}
