import { isAbsolute, relative } from 'node:path';
import {
  applyEdit,
  applyMultiEdit,
  applyWrite,
  seedFromReadResult,
  VirtualFileMap,
  type FileEditWarning,
} from './file-state.js';
import { pickTriggeringSentence } from './intent.js';
import { projectHash } from './project-hash.js';
import type {
  AssistantMessageRecord,
  SessionRecord,
  UserMessageRecord,
} from './schema.js';
import { classifySector, type Sector } from './sectors.js';
import { extractThinkingBefore } from './thinking.js';
import { tokenizeSentences, type Sentence } from './tokenizer.js';

export type { FileEditWarning } from './file-state.js';

// Narrow SessionRecord on the `type` discriminant. Spec 01's parseSessionRecord
// dispatcher already validated the full shape at read time, so these guards
// only need the literal check — TypeScript then narrows the union correctly
// without any `as` casts downstream.
function isUserRecord(r: SessionRecord): r is UserMessageRecord {
  return r.type === 'user';
}

function isAssistantRecord(r: SessionRecord): r is AssistantMessageRecord {
  return r.type === 'assistant';
}

function isFileEditOperation(
  name: string,
): name is 'Edit' | 'MultiEdit' | 'Write' {
  return name === 'Edit' || name === 'MultiEdit' || name === 'Write';
}

export interface Session {
  id: string;
  projectHash: string;
  projectPath: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  turns: Turn[];
  fileEdits: FileEdit[];
  firstPrompt: string;
  sectorSummary: SectorCounts;
}

export interface SectorCounts {
  migrations: number;
  models: number;
  controllers: number;
  views: number;
  tests: number;
  config: number;
  tasks: number;
  other: number;
}

export interface Turn {
  index: number;
  userMessage: UserMessage;
  assistantBlocks: AssistantBlock[];
  toolCalls: ToolCall[];
  startedAt: string;
  endedAt: string;
}

export interface UserMessage {
  text: string;
  sentences: Sentence[];
}

export type AssistantBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; toolCallId: string };

export interface ToolCall {
  id: string;
  turnIndex: number;
  tool: ToolName;
  input: unknown;
  result?: unknown;
  startedAt: string;
  tMs: number;
  fileEditId?: string;
}

export type ToolName =
  | 'Edit'
  | 'MultiEdit'
  | 'Write'
  | 'Read'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'Task'
  | 'TodoWrite'
  | string;

export interface FileEdit {
  id: string;
  orderIndex: number;
  toolCallId: string;
  turnIndex: number;
  path: string;
  sector: Sector;
  operation: 'Edit' | 'MultiEdit' | 'Write';
  preContent: string | null;
  postContent: string;
  additions: number;
  deletions: number;
  warnings: FileEditWarning[];
  triggeringUserMessage: string;
  triggeringSentence: Sentence | null;
  thinkingBlocks: string[];
  tMs: number;
}

export async function reconstructSession(
  records: AsyncIterable<SessionRecord>,
): Promise<Session> {
  let sessionId = '';
  let projectPathRaw = '';
  let firstPrompt: string | undefined;
  let startedAt: string | undefined;
  let endedAt: string | undefined;
  let startedMs: number | undefined;
  let fileEditOrder = 0;

  const turns: Turn[] = [];
  const fileEdits: FileEdit[] = [];
  const toolCallById = new Map<string, ToolCall>();
  const vfMap = new VirtualFileMap();

  type InProgressTurn = {
    startedAt: string;
    endedAt: string;
    userMessage: UserMessage;
    assistantBlocks: AssistantBlock[];
    toolCalls: ToolCall[];
  };
  let current: InProgressTurn | null = null;

  const finalize = (): void => {
    if (!current) return;
    turns.push({
      index: turns.length,
      userMessage: current.userMessage,
      assistantBlocks: current.assistantBlocks,
      toolCalls: current.toolCalls,
      startedAt: current.startedAt,
      endedAt: current.endedAt,
    });
    current = null;
  };

  const noteTime = (ts: string): void => {
    if (!ts) return;
    if (startedAt === undefined) {
      startedAt = ts;
      const parsed = Date.parse(ts);
      startedMs = Number.isFinite(parsed) ? parsed : undefined;
    }
    endedAt = ts;
  };

  const tMsFor = (ts: string): number => {
    const parsed = Date.parse(ts);
    if (!Number.isFinite(parsed) || startedMs === undefined) return 0;
    return Math.max(0, parsed - startedMs);
  };

  const handleUser = (rec: UserMessageRecord): void => {
    const ts = rec.timestamp;
    noteTime(ts);
    const content = rec.message.content;
    if (typeof content === 'string') {
      finalize();
      current = {
        startedAt: ts,
        endedAt: ts,
        userMessage: { text: content, sentences: tokenizeSentences(content) },
        assistantBlocks: [],
        toolCalls: [],
      };
      if (firstPrompt === undefined) {
        firstPrompt =
          content.length > 200 ? content.slice(0, 200) + '…' : content;
      }
      return;
    }
    // Array content on a user record carries tool_result blocks for the prior
    // turn's tool_use calls. Attach them by tool_use_id; do not open a new turn.
    if (current) current.endedAt = ts;
    for (const block of content) {
      if (block.type === 'tool_result') {
        const tc = toolCallById.get(block.tool_use_id);
        if (!tc) continue;
        tc.result = block.content;
        if (tc.tool === 'Read') {
          // Seed the virtual map with the file content the agent saw, so a
          // later Edit against the same path can match its old_string.
          const absPath = extractFilePath(tc.input);
          if (absPath !== null) {
            const relPath = relativizePath(absPath, projectPathRaw);
            seedFromReadResult(vfMap, relPath, block.content);
          }
        }
      }
    }
  };

  const handleAssistant = (rec: AssistantMessageRecord): void => {
    const ts = rec.timestamp;
    noteTime(ts);
    // Orphan assistant blocks before any user turn: silent skip.
    // We never invent a synthetic turn — the data model only exposes turns
    // that had a real human prompt.
    if (!current) return;
    current.endedAt = ts;
    for (const block of rec.message.content) {
      switch (block.type) {
        case 'text':
          current.assistantBlocks.push({ type: 'text', text: block.text });
          break;
        case 'thinking':
          // Spec 01 prereq: raw block carries `thinking`; normalized block
          // carries `text`. Rename happens here, not in the schema.
          current.assistantBlocks.push({
            type: 'thinking',
            text: block.thinking,
          });
          break;
        case 'tool_use': {
          const tMs = tMsFor(ts);
          const tc: ToolCall = {
            id: block.id,
            turnIndex: turns.length,
            tool: block.name,
            input: block.input,
            startedAt: ts,
            tMs,
          };
          // Push the tool_use assistantBlock FIRST so extractThinkingBefore
          // can anchor on it when collecting thinking blocks for the edit.
          // The final assistantBlocks order is identical to the prior
          // implementation (nothing else pushes between here and the
          // toolCalls push below).
          current.assistantBlocks.push({
            type: 'tool_use',
            toolCallId: block.id,
          });
          if (isFileEditOperation(block.name)) {
            const absPath = extractFilePath(block.input);
            if (absPath !== null) {
              const op = block.name;
              const relPath = relativizePath(absPath, projectPathRaw);
              const result =
                op === 'Write'
                  ? applyWrite(vfMap, relPath, block.input)
                  : op === 'MultiEdit'
                    ? applyMultiEdit(vfMap, relPath, block.input)
                    : applyEdit(vfMap, relPath, block.input);
              const triggeringSentence = pickTriggeringSentence(
                current.userMessage.sentences,
                relPath,
                op,
                result.postContent,
                block.input,
              );
              const thinkingBlocks = extractThinkingBefore(
                current.assistantBlocks,
                block.id,
              );
              const edit: FileEdit = {
                id: `edit-${block.id}`,
                orderIndex: fileEditOrder++,
                toolCallId: block.id,
                turnIndex: turns.length,
                path: relPath,
                sector: classifySector(relPath),
                operation: op,
                preContent: result.preContent,
                postContent: result.postContent,
                additions: result.additions,
                deletions: result.deletions,
                warnings: result.warnings,
                triggeringUserMessage: current.userMessage.text,
                triggeringSentence,
                thinkingBlocks,
                tMs,
              };
              tc.fileEditId = edit.id;
              fileEdits.push(edit);
            }
          }
          current.toolCalls.push(tc);
          toolCallById.set(tc.id, tc);
          break;
        }
        case 'tool_result':
          // Schema permits this on an assistant record but Claude Code does
          // not emit it there; nothing to attach.
          break;
      }
    }
  };

  for await (const record of records) {
    if (isUserRecord(record) || isAssistantRecord(record)) {
      if (!sessionId && typeof record.sessionId === 'string') {
        sessionId = record.sessionId;
      }
      if (!projectPathRaw && typeof record.cwd === 'string') {
        projectPathRaw = record.cwd;
      }
    }

    if (isUserRecord(record)) {
      handleUser(record);
    } else if (isAssistantRecord(record)) {
      handleAssistant(record);
    } else {
      // reason: Zod .passthrough() preserves unknown keys at runtime; TS can't express this in the OtherRecord type.
      const ts = (record as { timestamp?: unknown }).timestamp;
      if (typeof ts === 'string') noteTime(ts);
    }
  }

  finalize();

  const started = startedAt ?? '';
  const ended = endedAt ?? started;
  const startedParsed = Date.parse(started);
  const endedParsed = Date.parse(ended);
  const durationMs =
    Number.isFinite(startedParsed) && Number.isFinite(endedParsed)
      ? Math.max(0, endedParsed - startedParsed)
      : 0;

  return {
    id: sessionId,
    projectHash: projectPathRaw ? projectHash(projectPathRaw) : '',
    projectPath: projectPathRaw,
    startedAt: started,
    endedAt: ended,
    durationMs,
    turns,
    fileEdits,
    firstPrompt: firstPrompt ?? '',
    sectorSummary: computeSectorSummary(fileEdits),
  };
}

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

// macOS sessions sometimes carry /private/var/... paths where the project
// actually lives at /Users/... via symlink; a string-prefix check will miss
// those and we keep the absolute path as-is. v1 does not resolve symlinks —
// if this becomes a problem in practice, a future spec can address it.
function relativizePath(absPath: string, projectPathRaw: string): string {
  if (!projectPathRaw) return absPath;
  if (!isAbsolute(absPath)) return absPath;
  const base = projectPathRaw.endsWith('/')
    ? projectPathRaw.slice(0, -1)
    : projectPathRaw;
  if (absPath !== base && !absPath.startsWith(base + '/')) return absPath;
  const rel = relative(base, absPath);
  return rel === '' ? absPath : rel;
}

function computeSectorSummary(edits: FileEdit[]): SectorCounts {
  const counts: SectorCounts = {
    migrations: 0,
    models: 0,
    controllers: 0,
    views: 0,
    tests: 0,
    config: 0,
    tasks: 0,
    other: 0,
  };
  for (const e of edits) counts[e.sector] += 1;
  return counts;
}
