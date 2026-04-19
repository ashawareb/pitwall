import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  classifySector,
  readSessionRecords,
  type AssistantMessageRecord,
  type SectorCounts,
  type SessionRecord,
  type UserMessageRecord,
} from '@pitwall/parser';
import type { MtimeCache } from '../cache.js';

// OtherRecord in @pitwall/parser types `type` as plain string, so a bare
// `record.type === 'user'` check does not narrow the SessionRecord union.
// Predicates make the narrowing explicit — same pattern parser/session.ts uses.
function isUserRecord(r: SessionRecord): r is UserMessageRecord {
  return r.type === 'user';
}
function isAssistantRecord(r: SessionRecord): r is AssistantMessageRecord {
  return r.type === 'assistant';
}

const FIRST_PROMPT_MAX = 200;

export interface SessionMetadata {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  firstPrompt: string;
  fileCount: number;
  toolCallCount: number;
  sectorSummary: SectorCounts;
  cwd: string | null;
}

export interface DiscoveredProject {
  hash: string;
  path: string;
  pathSource: 'cwd' | 'hash-decoded';
  sessionFiles: string[];
  lastActivityAt: string;
  sessions: SessionMetadata[];
}

export type WarnFn = (msg: string, err: unknown) => void;

function emptySectorCounts(): SectorCounts {
  return {
    migrations: 0,
    models: 0,
    controllers: 0,
    views: 0,
    tests: 0,
    config: 0,
    tasks: 0,
    other: 0,
  };
}

// MultiEdit's structure is { file_path, edits: [{old_string, new_string}] } —
// the file_path is at the top, not inside each sub-edit. So one MultiEdit
// tool_use produces exactly one fileCount++ and one sectorSummary tick, which
// matches how spec 02/03 model MultiEdit as a single FileEdit. Never descend
// into input.edits[*].
function extractFilePath(input: unknown): string | null {
  if (
    typeof input === 'object' &&
    input !== null &&
    'file_path' in input &&
    typeof input.file_path === 'string'
  ) {
    return input.file_path;
  }
  return null;
}

function extractTimestamp(record: SessionRecord): string | null {
  if ('timestamp' in record && typeof record.timestamp === 'string') {
    return record.timestamp;
  }
  return null;
}

function extractCwd(record: SessionRecord): string | null {
  if ('cwd' in record && typeof record.cwd === 'string' && record.cwd.length > 0) {
    return record.cwd;
  }
  return null;
}

export async function readSessionMetadata(filepath: string): Promise<SessionMetadata> {
  const id = basename(filepath, '.jsonl');
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let firstPrompt: string | null = null;
  let cwd: string | null = null;
  let fileCount = 0;
  let toolCallCount = 0;
  const sectorSummary = emptySectorCounts();

  for await (const record of readSessionRecords(filepath)) {
    const ts = extractTimestamp(record);
    if (ts !== null) {
      if (startedAt === null) startedAt = ts;
      endedAt = ts;
    }

    if (cwd === null && (isUserRecord(record) || isAssistantRecord(record))) {
      const c = extractCwd(record);
      if (c !== null) cwd = c;
    }

    if (isUserRecord(record) && firstPrompt === null) {
      const content = record.message.content;
      if (typeof content === 'string') {
        firstPrompt =
          content.length > FIRST_PROMPT_MAX
            ? content.slice(0, FIRST_PROMPT_MAX) + '…'
            : content;
      }
    }

    if (isAssistantRecord(record)) {
      for (const block of record.message.content) {
        if (block.type === 'tool_use') {
          toolCallCount += 1;
          if (
            block.name === 'Edit' ||
            block.name === 'MultiEdit' ||
            block.name === 'Write'
          ) {
            const p = extractFilePath(block.input);
            if (p !== null) {
              fileCount += 1;
              sectorSummary[classifySector(p)] += 1;
            }
          }
        }
      }
    }
  }

  const start = startedAt ?? '';
  const end = endedAt ?? start;
  const startedParsed = Date.parse(start);
  const endedParsed = Date.parse(end);
  const durationMs =
    Number.isFinite(startedParsed) && Number.isFinite(endedParsed)
      ? Math.max(0, endedParsed - startedParsed)
      : 0;

  return {
    id,
    startedAt: start,
    endedAt: end,
    durationMs,
    firstPrompt: firstPrompt ?? '',
    fileCount,
    toolCallCount,
    sectorSummary,
    cwd,
  };
}

export async function listSessionFiles(projectDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(projectDir);
  } catch {
    return [];
  }
  const jsonl = entries.filter((f) => f.endsWith('.jsonl'));
  jsonl.sort();
  return jsonl.map((f) => join(projectDir, f));
}

// Naive fallback: strip the leading '-', replace remaining '-' with '/'.
// Lossy, because projectHash encoded both '/' and '.' as '-'. Callers flag
// this via pathSource: 'hash-decoded' so consumers treat it as approximate.
// Only used when the project has no readable session files yielding a cwd.
export function decodeHashToPath(hash: string): string {
  if (!hash.startsWith('-')) return hash;
  return '/' + hash.slice(1).split('-').join('/');
}

export function resolveProjectPath(
  hash: string,
  sessions: SessionMetadata[],
): { path: string; pathSource: 'cwd' | 'hash-decoded' } {
  for (const s of sessions) {
    if (s.cwd !== null) {
      return { path: s.cwd, pathSource: 'cwd' };
    }
  }
  return { path: decodeHashToPath(hash), pathSource: 'hash-decoded' };
}

function deriveLastActivityAt(
  sessions: SessionMetadata[],
  dirMtime: Date,
): string {
  let latest = '';
  let latestMs = -Infinity;
  for (const s of sessions) {
    if (s.endedAt === '') continue;
    const t = Date.parse(s.endedAt);
    if (Number.isFinite(t) && t > latestMs) {
      latestMs = t;
      latest = s.endedAt;
    }
  }
  return latest !== '' ? latest : dirMtime.toISOString();
}

export function compareIsoDesc(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  const va = Number.isFinite(ta) ? ta : -Infinity;
  const vb = Number.isFinite(tb) ? tb : -Infinity;
  return vb - va;
}

async function parseSessionsSkipFailures(
  files: string[],
  cache: MtimeCache<SessionMetadata>,
  warn: WarnFn,
): Promise<SessionMetadata[]> {
  const results = await Promise.all(
    files.map(async (f) => {
      try {
        return await cache.getOrCompute(f, readSessionMetadata);
      } catch (err) {
        warn(`Skipping unreadable session file: ${f}`, err);
        return null;
      }
    }),
  );
  return results.filter((r): r is SessionMetadata => r !== null);
}

export async function discoverProjects(
  projectsDir: string,
  cache: MtimeCache<SessionMetadata>,
  warn: WarnFn,
): Promise<DiscoveredProject[]> {
  let dirents: string[];
  try {
    dirents = await readdir(projectsDir);
  } catch {
    return [];
  }

  const projects: DiscoveredProject[] = [];
  for (const name of dirents) {
    const projectDir = join(projectsDir, name);
    let projectStat;
    try {
      projectStat = await stat(projectDir);
    } catch {
      continue;
    }
    if (!projectStat.isDirectory()) continue;

    const sessionFiles = await listSessionFiles(projectDir);
    const sessions = await parseSessionsSkipFailures(sessionFiles, cache, warn);
    const { path, pathSource } = resolveProjectPath(name, sessions);
    const lastActivityAt = deriveLastActivityAt(sessions, projectStat.mtime);

    projects.push({
      hash: name,
      path,
      pathSource,
      sessionFiles,
      lastActivityAt,
      sessions,
    });
  }

  projects.sort((a, b) => compareIsoDesc(a.lastActivityAt, b.lastActivityAt));
  return projects;
}
