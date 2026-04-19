import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Session } from '@pitwall/parser';
import type { MtimeCache } from '../cache.js';
import { computeReplay, type ReplayCache } from '../replay.js';
import {
  parseSession,
  resolveSessionFile,
  validateAndResolveProjectHash,
} from './session-path.js';

interface SessionReplayParams {
  hash: string;
  id: string;
  tMs: string;
}

// Non-negative integer only — no leading '+', sign, decimals, or hex. Anything
// else is bad input and gets 400. parseInt can silently accept "123abc"; the
// regex closes that gap before we parse.
const NON_NEGATIVE_INT_REGEX = /^\d+$/;

export async function registerSessionReplayRoute(
  app: FastifyInstance,
  sessionCache: MtimeCache<Session>,
  replayCache: ReplayCache,
): Promise<void> {
  app.get<{ Params: SessionReplayParams }>(
    '/api/projects/:hash/sessions/:id/replay/:tMs',
    async (req, reply) => {
      const tMsRaw = req.params.tMs;
      if (!NON_NEGATIVE_INT_REGEX.test(tMsRaw)) {
        return invalidTMs(reply, tMsRaw);
      }
      const tMs = Number.parseInt(tMsRaw, 10);
      // parseInt can still return a value outside the safe-integer range for
      // absurdly long digit strings (e.g. 20+ digits). Fail loud on those.
      if (!Number.isSafeInteger(tMs) || tMs < 0) {
        return invalidTMs(reply, tMsRaw);
      }

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

      return replayCache.getOrCompute(filepath, tMs, () =>
        computeReplay(session, tMs),
      );
    },
  );
}

function notFound(
  reply: FastifyReply,
  code: string,
  message: string,
): { error: string; code: string } {
  reply.status(404);
  return { error: message, code };
}

function invalidTMs(
  reply: FastifyReply,
  raw: string,
): { error: string; code: string } {
  reply.status(400);
  return {
    error: `Invalid tMs parameter: ${raw}`,
    code: 'invalid_tMs',
  };
}
