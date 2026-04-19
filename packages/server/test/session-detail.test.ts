import { utimes, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer, type StartedServer } from '../src/index.js';
import {
  assistantRecord,
  createTempClaudeHome,
  toolUse,
  userRecord,
  writeProjectDir,
  writeSession,
  type TempClaudeHome,
} from './helpers.js';

interface FileEditLite {
  id: string;
  orderIndex: number;
  path: string;
  operation: string;
  additions: number;
  deletions: number;
  warnings: unknown[];
  triggeringUserMessage: string;
  thinkingBlocks: string[];
  tMs: number;
}
interface SessionDetailResponse {
  id: string;
  projectHash: string;
  projectPath: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  firstPrompt: string;
  turns: Array<{ index: number; toolCalls: unknown[] }>;
  fileEdits: FileEditLite[];
  sectorSummary: Record<string, number>;
}
interface ErrorResponse {
  error: string;
  code: string;
}

describe('GET /api/projects/:hash/sessions/:id', () => {
  let tmp: TempClaudeHome | undefined;
  let server: StartedServer | undefined;

  beforeEach(() => {
    tmp = createTempClaudeHome();
    vi.stubEnv('PITWALL_CLAUDE_HOME', tmp.claudeHome);
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
    vi.unstubAllEnvs();
    if (tmp) {
      tmp.cleanup();
      tmp = undefined;
    }
  });

  it('returns 404 project_not_found for an unknown hash', async () => {
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-does-not-exist/sessions/s1`,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponse;
    expect(body.code).toBe('project_not_found');
  });

  it('returns 404 session_not_found for an unknown id and for shape violations', async () => {
    await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    server = await startServer({ port: 0, logger: false });

    const unknown = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/ghost`,
    );
    expect(unknown.status).toBe(404);
    expect(((await unknown.json()) as ErrorResponse).code).toBe(
      'session_not_found',
    );

    const dotDot = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/..%2Fetc`,
    );
    expect(dotDot.status).toBe(404);
    expect(((await dotDot.json()) as ErrorResponse).code).toBe(
      'session_not_found',
    );

    const withDot = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/has.dots`,
    );
    expect(withDot.status).toBe(404);
    expect(((await withDot.json()) as ErrorResponse).code).toBe(
      'session_not_found',
    );
  });

  it('returns the full session payload with fileEdits stripped of pre/postContent', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeSession(projectDir, 'sess-1', [
      userRecord({
        timestamp: '2026-04-18T10:00:00.000Z',
        content: 'Add a User model.',
        cwd: '/tmp/demo',
        sessionId: 'sess-1',
      }),
      assistantRecord({
        timestamp: '2026-04-18T10:00:01.000Z',
        blocks: [
          { type: 'thinking', thinking: 'Plan the model shape.' },
          { type: 'text', text: 'Creating the model.' },
          toolUse('tu1', 'Write', {
            file_path: '/tmp/demo/app/models/user.rb',
            content: 'class User\nend\n',
          }),
        ],
        cwd: '/tmp/demo',
        sessionId: 'sess-1',
      }),
    ]);

    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/sess-1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionDetailResponse;

    expect(body.id).toBe('sess-1');
    expect(body.projectPath).toBe('/tmp/demo');
    expect(body.startedAt).toBe('2026-04-18T10:00:00.000Z');
    expect(body.endedAt).toBe('2026-04-18T10:00:01.000Z');
    expect(body.durationMs).toBe(1000);
    expect(body.firstPrompt).toBe('Add a User model.');
    expect(body.turns).toHaveLength(1);
    expect(body.fileEdits).toHaveLength(1);

    const edit = body.fileEdits[0]!;
    expect(edit.path).toBe('app/models/user.rb');
    expect(edit.operation).toBe('Write');
    expect(edit.thinkingBlocks).toEqual(['Plan the model shape.']);
    expect(edit.triggeringUserMessage).toBe('Add a User model.');
    expect(edit.tMs).toBe(1000);
    expect(Object.keys(edit)).not.toContain('preContent');
    expect(Object.keys(edit)).not.toContain('postContent');
  });

  it('serves cached detail on repeat request (mtime unchanged)', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    const filepath = await writeSession(projectDir, 's1', [
      userRecord({
        timestamp: '2026-04-18T10:00:00.000Z',
        content: 'original',
        cwd: '/tmp/demo',
        sessionId: 's1',
      }),
      assistantRecord({
        timestamp: '2026-04-18T10:00:01.000Z',
        blocks: [],
        cwd: '/tmp/demo',
        sessionId: 's1',
      }),
    ]);

    const fixedTime = new Date('2026-04-18T10:00:00.000Z');
    await utimes(filepath, fixedTime, fixedTime);

    server = await startServer({ port: 0, logger: false });

    const first = (await (
      await fetch(
        `${server.address}/api/projects/-tmp-demo/sessions/s1`,
      )
    ).json()) as SessionDetailResponse;
    expect(first.firstPrompt).toBe('original');

    const mutated =
      [
        userRecord({
          timestamp: '2026-04-18T10:00:00.000Z',
          content: 'mutated',
          cwd: '/tmp/demo',
          sessionId: 's1',
        }),
        assistantRecord({
          timestamp: '2026-04-18T10:00:01.000Z',
          blocks: [],
          cwd: '/tmp/demo',
          sessionId: 's1',
        }),
      ]
        .map((r) => JSON.stringify(r))
        .join('\n') + '\n';
    await writeFile(filepath, mutated, 'utf8');
    await utimes(filepath, fixedTime, fixedTime);

    const second = (await (
      await fetch(
        `${server.address}/api/projects/-tmp-demo/sessions/s1`,
      )
    ).json()) as SessionDetailResponse;
    expect(second.firstPrompt).toBe('original');
  });

  it('reparses when mtime advances', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    const filepath = await writeSession(projectDir, 's1', [
      userRecord({
        timestamp: '2026-04-18T10:00:00.000Z',
        content: 'original',
        cwd: '/tmp/demo',
        sessionId: 's1',
      }),
      assistantRecord({
        timestamp: '2026-04-18T10:00:01.000Z',
        blocks: [],
        cwd: '/tmp/demo',
        sessionId: 's1',
      }),
    ]);

    const fixedTime = new Date('2026-04-18T10:00:00.000Z');
    await utimes(filepath, fixedTime, fixedTime);

    server = await startServer({ port: 0, logger: false });

    await fetch(`${server.address}/api/projects/-tmp-demo/sessions/s1`);

    const future = new Date(fixedTime.getTime() + 2000);
    const mutated =
      [
        userRecord({
          timestamp: '2026-04-18T10:00:00.000Z',
          content: 'mutated',
          cwd: '/tmp/demo',
          sessionId: 's1',
        }),
        assistantRecord({
          timestamp: '2026-04-18T10:00:01.000Z',
          blocks: [],
          cwd: '/tmp/demo',
          sessionId: 's1',
        }),
      ]
        .map((r) => JSON.stringify(r))
        .join('\n') + '\n';
    await writeFile(filepath, mutated, 'utf8');
    await utimes(filepath, future, future);

    const second = (await (
      await fetch(
        `${server.address}/api/projects/-tmp-demo/sessions/s1`,
      )
    ).json()) as SessionDetailResponse;
    expect(second.firstPrompt).toBe('mutated');
  });

  it('returns 500 parse_error when the JSONL is malformed', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    const filepath = `${projectDir}/broken.jsonl`;
    await writeFile(filepath, '{not json at all\n', 'utf8');

    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/broken`,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as ErrorResponse;
    expect(body.code).toBe('parse_error');
  });
});
