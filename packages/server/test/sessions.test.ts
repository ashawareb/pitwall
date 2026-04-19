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

interface SessionEntry {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  firstPrompt: string;
  fileCount: number;
  toolCallCount: number;
  sectorSummary: Record<string, number>;
}
interface SessionsResponse {
  projectHash: string;
  projectPath: string;
  sessions: SessionEntry[];
}
interface ErrorResponse {
  error: string;
  code: string;
}

describe('GET /api/projects/:hash/sessions', () => {
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
      `${server.address}/api/projects/-does-not-exist/sessions`,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponse;
    expect(body.code).toBe('project_not_found');
    expect(typeof body.error).toBe('string');
  });

  it('returns 404 for hashes that violate the shape regex', async () => {
    server = await startServer({ port: 0, logger: false });

    const noLead = await fetch(
      `${server.address}/api/projects/nolead/sessions`,
    );
    expect(noLead.status).toBe(404);
    expect(((await noLead.json()) as ErrorResponse).code).toBe(
      'project_not_found',
    );

    const traversal = await fetch(
      `${server.address}/api/projects/..%2Fetc/sessions`,
    );
    expect(traversal.status).toBe(404);
    expect(((await traversal.json()) as ErrorResponse).code).toBe(
      'project_not_found',
    );

    const withSpace = await fetch(
      `${server.address}/api/projects/-has%20space/sessions`,
    );
    expect(withSpace.status).toBe(404);
    expect(((await withSpace.json()) as ErrorResponse).code).toBe(
      'project_not_found',
    );
  });

  it('returns one session with full metadata matching the API contract', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeSession(projectDir, 'sess-1', [
      userRecord({
        timestamp: '2026-04-18T10:00:00.000Z',
        content: 'Please add a function.',
        cwd: '/tmp/demo',
        sessionId: 'sess-1',
      }),
      assistantRecord({
        timestamp: '2026-04-18T10:00:01.000Z',
        blocks: [
          { type: 'text', text: 'Okay.' },
          toolUse('tu1', 'Write', {
            file_path: '/tmp/demo/app/models/user.rb',
            content: 'class User;end',
          }),
          toolUse('tu2', 'Bash', { command: 'ls' }),
        ],
        cwd: '/tmp/demo',
        sessionId: 'sess-1',
      }),
    ]);

    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionsResponse;
    expect(body.projectHash).toBe('-tmp-demo');
    expect(body.projectPath).toBe('/tmp/demo');
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]).toEqual({
      id: 'sess-1',
      startedAt: '2026-04-18T10:00:00.000Z',
      endedAt: '2026-04-18T10:00:01.000Z',
      durationMs: 1000,
      firstPrompt: 'Please add a function.',
      fileCount: 1,
      toolCallCount: 2,
      sectorSummary: {
        migrations: 0,
        models: 1,
        controllers: 0,
        views: 0,
        tests: 0,
        config: 0,
        tasks: 0,
        other: 0,
      },
    });
  });

  it('orders multiple sessions by endedAt descending', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    const spec = [
      { id: 'early', month: '01' },
      { id: 'middle', month: '02' },
      { id: 'recent', month: '03' },
    ];
    for (const s of spec) {
      await writeSession(projectDir, s.id, [
        userRecord({
          timestamp: `2026-${s.month}-01T00:00:00.000Z`,
          content: s.id,
          cwd: '/tmp/demo',
          sessionId: s.id,
        }),
        assistantRecord({
          timestamp: `2026-${s.month}-01T00:00:05.000Z`,
          blocks: [],
          cwd: '/tmp/demo',
          sessionId: s.id,
        }),
      ]);
    }

    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions`,
    );
    const body = (await res.json()) as SessionsResponse;
    expect(body.sessions.map((s) => s.id)).toEqual([
      'recent',
      'middle',
      'early',
    ]);
  });

  it('serves stale cached metadata when content changes but mtime is preserved (cache HIT)', async () => {
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

    // Stabilize mtime to a whole-second value BEFORE the first fetch. writeFile
    // leaves the file with a sub-millisecond mtime (APFS has ns precision),
    // which utimes(..., Date) can only round-trip at ms precision. If we don't
    // normalize here, the cache populates with the fractional mtime and the
    // post-mutation utimes ends up with a different truncated value → spurious
    // cache miss in what should be a HIT test.
    const fixedTime = new Date('2026-04-18T10:00:00.000Z');
    await utimes(filepath, fixedTime, fixedTime);

    server = await startServer({ port: 0, logger: false });

    const first = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions`,
    );
    const firstBody = (await first.json()) as SessionsResponse;
    expect(firstBody.sessions[0]?.firstPrompt).toBe('original');

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

    const second = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions`,
    );
    const secondBody = (await second.json()) as SessionsResponse;
    expect(secondBody.sessions[0]?.firstPrompt).toBe('original');
  });

  it('reparses and returns fresh metadata when mtime advances (cache MISS)', async () => {
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

    const first = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions`,
    );
    const firstBody = (await first.json()) as SessionsResponse;
    expect(firstBody.sessions[0]?.firstPrompt).toBe('original');

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

    const second = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions`,
    );
    const secondBody = (await second.json()) as SessionsResponse;
    expect(secondBody.sessions[0]?.firstPrompt).toBe('mutated');
  });
});
