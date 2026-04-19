import { performance } from 'node:perf_hooks';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
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

// Perf tests are skippable on slow/unrepresentative runners via
// PITWALL_SKIP_PERF=1 (e.g. heavily contended CI boxes). They are wall-clock
// sensitive, so warm measurements use the median of several samples to damp
// single-run noise, while cold uses a single measurement by definition.
const SKIP_PERF = process.env.PITWALL_SKIP_PERF === '1';

const SESSION_COUNT = 100;
const EDITS_PER_SESSION = 3;
const WARM_SAMPLES = 5;

const PROJECT_HASH = '-perf-project';
const SAMPLE_SESSION_ID = 's-050';
const SAMPLE_EDIT_ID = 'edit-tu-50-0';

// Use tMs past session end so the replay materializes a non-empty snapshot.
const REPLAY_T_MS = 5000;

describe.skipIf(SKIP_PERF)('performance acceptance (spec 06 + 07)', () => {
  let tmp: TempClaudeHome | undefined;
  let server: StartedServer | undefined;

  beforeAll(async () => {
    tmp = createTempClaudeHome();
    process.env.PITWALL_CLAUDE_HOME = tmp.claudeHome;
    const projectDir = await writeProjectDir(tmp.projectsDir, PROJECT_HASH);
    for (let i = 0; i < SESSION_COUNT; i++) {
      await writeFixtureSession(projectDir, i);
    }
  }, 60_000);

  afterAll(() => {
    if (tmp) {
      tmp.cleanup();
      tmp = undefined;
    }
    delete process.env.PITWALL_CLAUDE_HOME;
  });

  beforeEach(async () => {
    server = await startServer({ port: 0, logger: false });
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  async function time(url: string): Promise<number> {
    const start = performance.now();
    const res = await fetch(url);
    await res.text();
    const elapsed = performance.now() - start;
    expect(res.status).toBeLessThan(500);
    return elapsed;
  }

  async function warmMedian(url: string): Promise<number> {
    const samples: number[] = [];
    for (let i = 0; i < WARM_SAMPLES; i++) {
      samples.push(await time(url));
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)]!;
  }

  it('GET /api/projects: cold under 1s, warm under 100ms', async () => {
    const url = `${server!.address}/api/projects`;
    const cold = await time(url);
    expect(cold).toBeLessThan(1000);
    expect(await warmMedian(url)).toBeLessThan(100);
  });

  it('GET /api/projects/:hash/sessions: cold under 1s, warm under 100ms', async () => {
    const url = `${server!.address}/api/projects/${PROJECT_HASH}/sessions`;
    const cold = await time(url);
    expect(cold).toBeLessThan(1000);
    expect(await warmMedian(url)).toBeLessThan(100);
  });

  it('GET /api/projects/:hash/sessions/:id: cold under 200ms, warm under 20ms', async () => {
    const url = `${server!.address}/api/projects/${PROJECT_HASH}/sessions/${SAMPLE_SESSION_ID}`;
    const cold = await time(url);
    expect(cold).toBeLessThan(200);
    expect(await warmMedian(url)).toBeLessThan(20);
  });

  it('GET /api/projects/:hash/sessions/:id/files/:editId: warm under 50ms', async () => {
    const fileUrl = `${server!.address}/api/projects/${PROJECT_HASH}/sessions/${SAMPLE_SESSION_ID}/files/${SAMPLE_EDIT_ID}`;
    // Warm the sessionCache before measuring; spec gives this endpoint only a
    // warm budget because the file payload is a pure Map lookup once parsed.
    await fetch(
      `${server!.address}/api/projects/${PROJECT_HASH}/sessions/${SAMPLE_SESSION_ID}`,
    );
    expect(await warmMedian(fileUrl)).toBeLessThan(50);
  });

  it('GET /api/projects/:hash/sessions/:id/replay/:tMs: cold under 200ms, warm under 50ms', async () => {
    const url = `${server!.address}/api/projects/${PROJECT_HASH}/sessions/${SAMPLE_SESSION_ID}/replay/${REPLAY_T_MS}`;
    const cold = await time(url);
    expect(cold).toBeLessThan(200);
    expect(await warmMedian(url)).toBeLessThan(50);
  });
});

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

async function writeFixtureSession(
  projectDir: string,
  i: number,
): Promise<void> {
  // 100 sessions span 10:00:00 through 10:01:39 so every timestamp is valid
  // ISO-8601. sessionId is zero-padded so lexical sort = numeric sort.
  const minute = pad(Math.floor(i / 60));
  const second = pad(i % 60);
  const base = new Date(`2026-04-18T10:${minute}:${second}.000Z`);
  const sessionId = `s-${pad(i, 3)}`;

  const blocks: Record<string, unknown>[] = [];
  for (let j = 0; j < EDITS_PER_SESSION; j++) {
    blocks.push(
      toolUse(`tu-${i}-${j}`, 'Write', {
        file_path: `/tmp/perf/f${i}-${j}.txt`,
        content: `content-${i}-${j}`,
      }),
    );
  }

  await writeSession(projectDir, sessionId, [
    userRecord({
      timestamp: base.toISOString(),
      content: `Session ${i} prompt`,
      cwd: '/tmp/perf',
      sessionId,
    }),
    assistantRecord({
      timestamp: new Date(base.getTime() + 1000).toISOString(),
      blocks,
      cwd: '/tmp/perf',
      sessionId,
    }),
  ]);
}
