import type { FastifyInstance, FastifyReply } from 'fastify';
import type { MtimeCache } from '../cache.js';
import {
  compareIsoDesc,
  listSessionFiles,
  readSessionMetadata,
  resolveProjectPath,
  type SessionMetadata,
} from '../fs/discover.js';
import { validateAndResolveProjectHash } from './session-path.js';

interface SessionsParams {
  hash: string;
}

export async function registerSessionsRoute(
  app: FastifyInstance,
  cache: MtimeCache<SessionMetadata>,
): Promise<void> {
  app.get<{ Params: SessionsParams }>(
    '/api/projects/:hash/sessions',
    async (req, reply) => {
      const project = await validateAndResolveProjectHash(req.params.hash);
      if (!project) return notFound(reply);

      const files = await listSessionFiles(project.projectDir);
      const results = await Promise.all(
        files.map(async (f) => {
          try {
            return await cache.getOrCompute(f, readSessionMetadata);
          } catch (err) {
            app.log.warn({ err }, `Skipping unreadable session file: ${f}`);
            return null;
          }
        }),
      );
      const sessions = results.filter(
        (r): r is SessionMetadata => r !== null,
      );
      sessions.sort((a, b) => compareIsoDesc(a.endedAt, b.endedAt));

      const { path: projectPath } = resolveProjectPath(project.hash, sessions);

      return {
        projectHash: project.hash,
        projectPath,
        sessions: sessions.map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          durationMs: s.durationMs,
          firstPrompt: s.firstPrompt,
          fileCount: s.fileCount,
          toolCallCount: s.toolCallCount,
          sectorSummary: s.sectorSummary,
        })),
      };
    },
  );
}

function notFound(reply: FastifyReply): { error: string; code: string } {
  reply.status(404);
  return { error: 'Project not found', code: 'project_not_found' };
}
