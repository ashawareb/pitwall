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

interface FileResponse {
  editId: string;
  path: string;
  preContent: string | null;
  postContent: string;
  language: string;
}
interface ErrorResponse {
  error: string;
  code: string;
}

// Write + Edit sequence. The VirtualFileMap persists across turns, so the
// second-turn Edit sees the first-turn Write's content without any Read
// tool_result seed.
async function writeSeededSession(projectDir: string): Promise<void> {
  await writeSession(projectDir, 's1', [
    userRecord({
      timestamp: '2026-04-18T10:00:00.000Z',
      content: 'Create the file.',
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    assistantRecord({
      timestamp: '2026-04-18T10:00:01.000Z',
      blocks: [
        toolUse('tu1', 'Write', {
          file_path: '/tmp/demo/app/models/user.rb',
          content: 'class User\nend\n',
        }),
      ],
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    userRecord({
      timestamp: '2026-04-18T10:00:02.000Z',
      content: 'Add a name attribute.',
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
    assistantRecord({
      timestamp: '2026-04-18T10:00:03.000Z',
      blocks: [
        toolUse('tu2', 'Edit', {
          file_path: '/tmp/demo/app/models/user.rb',
          old_string: 'class User\nend\n',
          new_string: 'class User\n  attr_accessor :name\nend\n',
        }),
      ],
      cwd: '/tmp/demo',
      sessionId: 's1',
    }),
  ]);
}

describe('GET /api/projects/:hash/sessions/:id/files/:editId', () => {
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
      `${server.address}/api/projects/-nope/sessions/s1/files/edit-tu1`,
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
      `${server.address}/api/projects/-tmp-demo/sessions/ghost/files/edit-tu1`,
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorResponse).code).toBe(
      'session_not_found',
    );
  });

  it('returns 404 edit_not_found for an unknown edit id', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeSeededSession(projectDir);
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/s1/files/edit-missing`,
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorResponse).code).toBe('edit_not_found');
  });

  it('returns preContent=null, postContent, and language for a Write edit', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeSeededSession(projectDir);
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/s1/files/edit-tu1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as FileResponse;
    expect(body).toEqual({
      editId: 'edit-tu1',
      path: 'app/models/user.rb',
      preContent: null,
      postContent: 'class User\nend\n',
      language: 'ruby',
    });
  });

  it('returns preContent and postContent for a subsequent Edit', async () => {
    const projectDir = await writeProjectDir(tmp!.projectsDir, '-tmp-demo');
    await writeSeededSession(projectDir);
    server = await startServer({ port: 0, logger: false });
    const res = await fetch(
      `${server.address}/api/projects/-tmp-demo/sessions/s1/files/edit-tu2`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as FileResponse;
    expect(body.editId).toBe('edit-tu2');
    expect(body.preContent).toBe('class User\nend\n');
    expect(body.postContent).toBe('class User\n  attr_accessor :name\nend\n');
    expect(body.language).toBe('ruby');
  });
});
