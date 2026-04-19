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

interface ReplayFile {
  path: string;
  content: string;
  lastEditedTMs: number;
}
interface ReplayResponse {
  tMs: number;
  files: ReplayFile[];
}
interface ErrorResponse {
  error: string;
  code: string;
}

// Multi-edit session. Session starts at t=0. File A is Written at t=1000,
// File B is Written at t=3000, File A is Edited at t=5000. A final Edit at
// t=7000 misses its old_string (edit_miss). Total duration: 7000ms.
async function writeScrubSession(projectDir: string): Promise<void> {
  await writeSession(projectDir, 's1', [
    userRecord({
      timestamp: '2026-04-18T10:00:00.000Z',
      content: 'Start.',
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    assistantRecord({
      timestamp: '2026-04-18T10:00:01.000Z',
      blocks: [
        toolUse('tu1', 'Write', {
          file_path: '/tmp/demo/a.txt',
          content: 'hello',
        }),
      ],
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    userRecord({
      timestamp: '2026-04-18T10:00:02.000Z',
      content: 'Another file.',
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    assistantRecord({
      timestamp: '2026-04-18T10:00:03.000Z',
      blocks: [
        toolUse('tu2', 'Write', {
          file_path: '/tmp/demo/b.txt',
          content: 'world',
        }),
      ],
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    userRecord({
      timestamp: '2026-04-18T10:00:04.000Z',
      content: 'Tweak a.',
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    assistantRecord({
      timestamp: '2026-04-18T10:00:05.000Z',
      blocks: [
        toolUse('tu3', 'Edit', {
          file_path: '/tmp/demo/a.txt',
          old_string: 'hello',
          new_string: 'goodbye',
        }),
      ],
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    userRecord({
      timestamp: '2026-04-18T10:00:06.000Z',
      content: 'Try a miss.',
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    assistantRecord({
      timestamp: '2026-04-18T10:00:07.000Z',
      blocks: [
        toolUse('tu4', 'Edit', {
          file_path: '/tmp/demo/a.txt',
          old_string: 'not-in-file',
          new_string: 'will-not-apply',
        }),
      ],
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
  ]);
}

describe('GET /api/projects/:hash/sessions/:id/replay/:tMs', () => {
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

  it('returns 400 invalid_tMs for a non-numeric tMs parameter', async () => {
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-any/sessions/s1/replay/abc`,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.code).toBe('invalid_tMs');
  });

  it('returns 400 invalid_tMs for a float, a negative, and a value past safe-integer range', async () => {
    server = await startServer({ port: 0, logger: false });

    const float = await fetch(
      `${server.address}/api/projects/-any/sessions/s1/replay/1.5`,
    );
    expect(float.status).toBe(400);
    expect(((await float.json()) as ErrorResponse).code).toBe('invalid_tMs');

    const negative = await fetch(
      `${server.address}/api/projects/-any/sessions/s1/replay/-5`,
    );
    expect(negative.status).toBe(400);
    expect(((await negative.json()) as ErrorResponse).code).toBe(
      'invalid_tMs',
    );

    const overflow = await fetch(
      `${server.address}/api/projects/-any/sessions/s1/replay/99999999999999999999`,
    );
    expect(overflow.status).toBe(400);
    expect(((await overflow.json()) as ErrorResponse).code).toBe(
      'invalid_tMs',
    );
  });

  it('returns 404 project_not_found for an unknown hash', async () => {
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-missing/sessions/s1/replay/0`,
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorResponse).code).toBe(
      'project_not_found',
    );
  });

  it('returns 404 session_not_found when the session file does not exist', async () => {
    await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/ghost/replay/0`,
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorResponse).code).toBe(
      'session_not_found',
    );
  });

  it('returns an empty file list at tMs=0 (initial state)', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeScrubSession(projectDir);
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/s1/replay/0`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReplayResponse;
    expect(body).toEqual({ tMs: 0, files: [] });
  });

  it('returns the full final state at tMs past session duration', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeScrubSession(projectDir);
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/s1/replay/99999`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReplayResponse;
    expect(body.tMs).toBe(99999);
    expect(body.files).toEqual([
      { path: 'a.txt', content: 'goodbye', lastEditedTMs: 5000 },
      { path: 'b.txt', content: 'world', lastEditedTMs: 3000 },
    ]);
  });

  it('returns partial state mid-session', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeScrubSession(projectDir);
    server = await startServer({ port: 0, logger: false });

    // After Write A (t=1000), before Write B.
    const mid1 = (await (
      await fetch(
        `${server.address}/api/projects/-tmp-demo/sessions/s1/replay/2000`,
      )
    ).json()) as ReplayResponse;
    expect(mid1.files).toEqual([
      { path: 'a.txt', content: 'hello', lastEditedTMs: 1000 },
    ]);

    // After Write B (t=3000), before Edit A.
    const mid2 = (await (
      await fetch(
        `${server.address}/api/projects/-tmp-demo/sessions/s1/replay/4000`,
      )
    ).json()) as ReplayResponse;
    expect(mid2.files).toEqual([
      { path: 'a.txt', content: 'hello', lastEditedTMs: 1000 },
      { path: 'b.txt', content: 'world', lastEditedTMs: 3000 },
    ]);
  });

  it('skips edits flagged with edit_miss (state survives the failed edit)', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeScrubSession(projectDir);
    server = await startServer({ port: 0, logger: false });

    // The tu4 Edit at t=7000 has a missing old_string. After it, A must still
    // read "goodbye" (from the tu3 Edit at t=5000), not "".
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/s1/replay/8000`,
    );
    const body = (await res.json()) as ReplayResponse;
    const a = body.files.find((f) => f.path === 'a.txt');
    expect(a).toEqual({
      path: 'a.txt',
      content: 'goodbye',
      lastEditedTMs: 5000,
    });
  });
});
