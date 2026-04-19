// Client-side TypeScript types for the server REST API.
//
// Declared by hand against docs/03-api-contract.md — no Zod in spec 08
// (deferred to spec 09 when there is real data to validate against). The
// right coupling here is client ↔ server wire contract, not client ↔ parser
// internals, so response envelopes are declared locally.
//
// For types that are structurally identical between parser output and the
// wire (Sector, FileEditWarning, SectorCounts, Sentence, and the inner pieces
// of Turn), we re-export from @pitwall/parser to avoid drift. Anything that
// the server reshapes (e.g. FileEdit loses preContent/postContent) is
// declared locally as its own wire type.

import type {
  AssistantBlock,
  FileEditWarning,
  Sector,
  SectorCounts,
  Sentence,
  ToolCall,
  ToolName,
  Turn,
  UserMessage,
} from '@pitwall/parser';

export type {
  AssistantBlock,
  FileEditWarning,
  Sector,
  SectorCounts,
  Sentence,
  ToolCall,
  ToolName,
  Turn,
  UserMessage,
};

// GET /api/health
export interface HealthResponse {
  ok: true;
  version: string;
  apiVersion: 1;
}

// GET /api/projects
export interface ProjectSummary {
  hash: string;
  path: string;
  pathSource: 'cwd' | 'hash-decoded';
  sessionCount: number;
  lastActivityAt: string;
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

// GET /api/projects/:hash/sessions
export interface SessionListItem {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  firstPrompt: string;
  fileCount: number;
  toolCallCount: number;
  sectorSummary: SectorCounts;
}

export interface SessionListResponse {
  projectHash: string;
  projectPath: string;
  sessions: SessionListItem[];
}

// GET /api/projects/:hash/sessions/:id
// FileEdit on the wire is the parser's FileEdit minus preContent and
// postContent — the server drops those to keep the detail payload small, and
// the client fetches per-file content through the files endpoint.
export interface FileEditSummary {
  id: string;
  orderIndex: number;
  toolCallId: string;
  turnIndex: number;
  path: string;
  sector: Sector;
  operation: 'Edit' | 'MultiEdit' | 'Write';
  additions: number;
  deletions: number;
  warnings: FileEditWarning[];
  triggeringUserMessage: string;
  triggeringSentence: Sentence | null;
  thinkingBlocks: string[];
  tMs: number;
}

export interface SessionDetailResponse {
  id: string;
  projectHash: string;
  projectPath: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  turns: Turn[];
  firstPrompt: string;
  sectorSummary: SectorCounts;
  fileEdits: FileEditSummary[];
}

// GET /api/projects/:hash/sessions/:id/files/:editId
export interface SessionFileResponse {
  editId: string;
  path: string;
  preContent: string | null;
  postContent: string;
  language: string;
}

// GET /api/projects/:hash/sessions/:id/replay/:tMs
export interface ReplayFile {
  path: string;
  content: string;
  lastEditedTMs: number;
}

export interface SessionReplayResponse {
  tMs: number;
  files: ReplayFile[];
}

// 4xx / 5xx body shape per docs/03-api-contract.md §Conventions.
export interface ApiErrorBody {
  error: string;
  code: string;
}
