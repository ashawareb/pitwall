import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Session } from '@pitwall/parser';
import type { MtimeCache } from '../cache.js';
import { detectLanguage } from '../lang.js';
import {
  parseSession,
  resolveSessionFile,
  validateAndResolveProjectHash,
} from './session-path.js';

interface SessionFileParams {
  hash: string;
  id: string;
  editId: string;
}

export async function registerSessionFileRoute(
  app: FastifyInstance,
  sessionCache: MtimeCache<Session>,
): Promise<void> {
  app.get<{ Params: SessionFileParams }>(
    '/api/projects/:hash/sessions/:id/files/:editId',
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

      const edit = session.fileEdits.find((e) => e.id === req.params.editId);
      if (!edit) {
        return notFound(reply, 'edit_not_found', 'Edit not found');
      }

      return {
        editId: edit.id,
        path: edit.path,
        preContent: edit.preContent,
        postContent: edit.postContent,
        language: detectLanguage(edit.path),
      };
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
