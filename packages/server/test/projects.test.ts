import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer, type StartedServer } from '../src/index.js';
import {
  assistantRecord,
  createTempClaudeHome,
  userRecord,
  writeProjectDir,
  writeSession,
  type TempClaudeHome,
} from './helpers.js';

interface ProjectEntry {
  hash: string;
  path: string;
  pathSource: 'cwd' | 'hash-decoded';
  sessionCount: number;
  lastActivityAt: string;
}
interface ProjectsResponse {
  projects: ProjectEntry[];
}

describe('GET /api/projects', () => {
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

  it('returns an empty projects array when the projects dir does not exist', async () => {
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(`${server.address}/api/projects`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProjectsResponse;
    expect(body).toEqual({ projects: [] });
  });

  it('returns an empty projects array when the projects dir is empty', async () => {
    await mkdir(tmp!.projectsDir, { recursive: true });
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(`${server.address}/api/projects`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProjectsResponse;
    expect(body).toEqual({ projects: [] });
  });

  it('returns one project with pathSource: cwd and accurate metadata', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeSession(projectDir, 's1', [
      userRecord({
        timestamp: '2026-04-18T10:00:00.000Z',
        content: 'hello',
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

    server = await startServer({ port: 0, logger: false });
    const res = await fetch(`${server.address}/api/projects`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProjectsResponse;
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toEqual({
      hash: '-tmp-demo',
      path: '/tmp/demo',
      pathSource: 'cwd',
      sessionCount: 1,
      lastActivityAt: '2026-04-18T10:00:01.000Z',
    });
  });

  it('orders projects by lastActivityAt descending', async () => {
    const oldDir = await writeProjectDir(tmp!.projectsDir, '-tmp-old');
    await writeSession(oldDir, 'sOld', [
      userRecord({
        timestamp: '2026-01-01T00:00:00.000Z',
        content: 'old',
        cwd: '/tmp/old',
        sessionId: 'sOld',
      }),
      assistantRecord({
        timestamp: '2026-01-01T00:00:10.000Z',
        blocks: [],
        cwd: '/tmp/old',
        sessionId: 'sOld',
      }),
    ]);
    const newDir = await writeProjectDir(tmp!.projectsDir, '-tmp-new');
    await writeSession(newDir, 'sNew', [
      userRecord({
        timestamp: '2026-04-01T00:00:00.000Z',
        content: 'new',
        cwd: '/tmp/new',
        sessionId: 'sNew',
      }),
      assistantRecord({
        timestamp: '2026-04-01T00:00:10.000Z',
        blocks: [],
        cwd: '/tmp/new',
        sessionId: 'sNew',
      }),
    ]);

    server = await startServer({ port: 0, logger: false });
    const res = await fetch(`${server.address}/api/projects`);
    const body = (await res.json()) as ProjectsResponse;
    expect(body.projects.map((p) => p.hash)).toEqual(['-tmp-new', '-tmp-old']);
  });

  it('includes a zero-session project with pathSource: hash-decoded and dir mtime', async () => {
    await writeProjectDir(tmp!.projectsDir, '-Users-test-empty');
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(`${server.address}/api/projects`);
    const body = (await res.json()) as ProjectsResponse;
    expect(body.projects).toHaveLength(1);
    const entry = body.projects[0];
    expect(entry).toBeDefined();
    expect(entry?.hash).toBe('-Users-test-empty');
    expect(entry?.path).toBe('/Users/test/empty');
    expect(entry?.pathSource).toBe('hash-decoded');
    expect(entry?.sessionCount).toBe(0);
    expect(new Date(entry?.lastActivityAt ?? '').getTime()).toBeGreaterThan(0);
  });

  it('renders the static fixture under test/fixtures/claude-home/', async () => {
    vi.unstubAllEnvs();
    const fixtureHome = fileURLToPath(
      new URL('./fixtures/claude-home', import.meta.url),
    );
    vi.stubEnv('PITWALL_CLAUDE_HOME', fixtureHome);

    server = await startServer({ port: 0, logger: false });
    const res = await fetch(`${server.address}/api/projects`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProjectsResponse;
    expect(body.projects.length).toBeGreaterThanOrEqual(1);
    const fixture = body.projects.find((p) => p.hash === '-tmp-fixture');
    expect(fixture).toBeDefined();
    expect(fixture?.path).toBe('/tmp/fixture');
    expect(fixture?.pathSource).toBe('cwd');
    expect(fixture?.sessionCount).toBe(1);
  });
});
