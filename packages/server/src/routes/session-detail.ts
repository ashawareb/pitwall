import type { FastifyInstance, FastifyReply } from 'fastify';
import type { FileEdit, Session } from '@pitwall/parser';
import type { MtimeCache } from '../cache.js';
import {
  parseSession,
  resolveSessionFile,
  validateAndResolveProjectHash,
} from './session-path.js';

interface SessionDetailParams {
  hash: string;
  id: string;
}

export async function registerSessionDetailRoute(
  app: FastifyInstance,
  sessionCache: MtimeCache<Session>,
): Promise<void> {
  app.get<{ Params: SessionDetailParams }>(
    '/api/projects/:hash/sessions/:id',
    async (req, reply) => {
      const project = await validateAndResolveProjectHash(req.params.hash);
      if (!project) {
        return notFound(reply, 'project_not_found', 'Project not found');
      }

      const filepath = await resolveSessionFile(
        project.projectDir,
        req.params.id,
      );
      if (!filepath) {
        return notFound(reply, 'session_not_found', 'Session not found');
      }

      let session: Session;
      try {
        session = await parseSession(filepath, sessionCache);
      } catch (err) {
        req.log.warn({ err }, `Failed to parse session ${filepath}`);
        reply.status(500);
        return { error: 'Failed to parse session', code: 'parse_error' };
      }

      return {
        id: session.id,
        projectHash: session.projectHash,
        projectPath: session.projectPath,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMs: session.durationMs,
        turns: session.turns,
        firstPrompt: session.firstPrompt,
        sectorSummary: session.sectorSummary,
        fileEdits: session.fileEdits.map(stripEditContent),
      };
    },
  );
}

// List the surviving fields explicitly rather than destructuring preContent
// and postContent away. If a future FileEdit field is added, the default is
// NOT to leak it onto the wire — someone has to opt each field in here. That
// is the safer default for a detail payload that already dropped two fields
// for size reasons.
function stripEditContent(e: FileEdit): Omit<FileEdit, 'preContent' | 'postContent'> {
  return {
    id: e.id,
    orderIndex: e.orderIndex,
    toolCallId: e.toolCallId,
    turnIndex: e.turnIndex,
    path: e.path,
    sector: e.sector,
    operation: e.operation,
    additions: e.additions,
    deletions: e.deletions,
    warnings: e.warnings,
    triggeringUserMessage: e.triggeringUserMessage,
    triggeringSentence: e.triggeringSentence,
    thinkingBlocks: e.thinkingBlocks,
    tMs: e.tMs,
  };
}

function notFound(
  reply: FastifyReply,
  code: string,
  message: string,
): { error: string; code: string } {
  reply.status(404);
  return { error: message, code };
}
