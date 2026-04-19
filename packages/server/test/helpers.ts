import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TempClaudeHome {
  claudeHome: string;
  projectsDir: string;
  cleanup: () => void;
}

export function createTempClaudeHome(): TempClaudeHome {
  const dir = mkdtempSync(join(tmpdir(), 'pitwall-test-'));
  return {
    claudeHome: dir,
    projectsDir: join(dir, 'projects'),
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function writeProjectDir(
  projectsDir: string,
  hash: string,
): Promise<string> {
  const projectDir = join(projectsDir, hash);
  await mkdir(projectDir, { recursive: true });
  return projectDir;
}

type JsonlRecord = Record<string, unknown>;

export async function writeSession(
  projectDir: string,
  id: string,
  records: JsonlRecord[],
): Promise<string> {
  const filepath = join(projectDir, `${id}.jsonl`);
  const content = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await writeFile(filepath, content, 'utf8');
  return filepath;
}

export function userRecord(params: {
  timestamp: string;
  content: string;
  cwd?: string;
  sessionId?: string;
  uuid?: string;
}): JsonlRecord {
  const record: JsonlRecord = {
    type: 'user',
    uuid: params.uuid ?? `u-${params.timestamp}`,
    timestamp: params.timestamp,
    sessionId: params.sessionId ?? 's1',
    message: { role: 'user', content: params.content },
  };
  if (params.cwd !== undefined) record.cwd = params.cwd;
  return record;
}

export function assistantRecord(params: {
  timestamp: string;
  blocks: JsonlRecord[];
  cwd?: string;
  sessionId?: string;
  uuid?: string;
  parentUuid?: string;
}): JsonlRecord {
  const record: JsonlRecord = {
    type: 'assistant',
    uuid: params.uuid ?? `a-${params.timestamp}`,
    timestamp: params.timestamp,
    sessionId: params.sessionId ?? 's1',
    message: { role: 'assistant', content: params.blocks },
  };
  if (params.parentUuid !== undefined) record.parentUuid = params.parentUuid;
  if (params.cwd !== undefined) record.cwd = params.cwd;
  return record;
}

export function toolUse(id: string, name: string, input: unknown): JsonlRecord {
  return { type: 'tool_use', id, name, input };
}
