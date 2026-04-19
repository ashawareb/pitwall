# 02 · Data model

Every package uses the same types. They live in `@pitwall/parser`
and are re-exported. Do not redefine them anywhere else.

## The Claude Code JSONL format

Every Claude Code session writes a JSONL file at
`~/.claude/projects/<project-hash>/<session-uuid>.jsonl`. Each line is
one JSON record. Records include (among others):

- `user` messages (the prompts the user sent)
- `assistant` messages (mixes of text, thinking blocks, and tool_use
  blocks)
- `tool_use` blocks (requests to call tools like Edit, Write,
  MultiEdit, Read, Bash, Task)
- `tool_result` blocks (the output of those calls)

The schema evolves. Spec 01 defines exact validation.

## Core types

These are normative. They are what the parser emits and what the server
exposes. The client consumes them unchanged.

### `Session`

A single Claude Code session. One-to-one with one JSONL file.

```ts
export interface Session {
  id: string;                 // UUID, matches the JSONL filename
  projectHash: string;        // The <hash> in the path
  projectPath: string;        // Decoded absolute path of the project
  startedAt: string;          // ISO timestamp, first record
  endedAt: string;            // ISO timestamp, last record
  durationMs: number;         // endedAt - startedAt
  turns: Turn[];              // In chronological order
  fileEdits: FileEdit[];      // In chronological order (SEE NOTE)
  firstPrompt: string;        // Truncated for display in the picker
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
```

> **Note:** `projectHash` is derived from `projectPath` by replacing
> every `/` and every `.` with `-`. Existing dashes are preserved.
> This matches Claude Code's on-disk layout under
> `~/.claude/projects/` and was verified empirically against the live
> directory listing. Spec 15 (the CLI) depends on this algorithm; do
> not re-derive it elsewhere — import the `projectHash` helper from
> `@pitwall/parser`.

> **Critical:** `fileEdits` is in the order the AI made them. This is
> the primary ordering throughout Pitwall. Alphabetical ordering is
> never the default, anywhere. See `docs/00-overview.md`.

### `Turn`

One turn of the conversation: a user message + the assistant's response
to it. Multiple tool calls can happen within a single turn.

```ts
export interface Turn {
  index: number;                   // 0-based, within the session
  userMessage: UserMessage;
  assistantBlocks: AssistantBlock[];
  toolCalls: ToolCall[];           // In chronological order
  startedAt: string;
  endedAt: string;
}

export interface UserMessage {
  text: string;
  sentences: Sentence[];           // Tokenized — see "Sentence tokenization"
}

export interface Sentence {
  index: number;
  text: string;
  startChar: number;               // Inclusive
  endChar: number;                 // Exclusive
}

export type AssistantBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; toolCallId: string };
```

### `ToolCall`

One invocation of a tool by the assistant.

```ts
export interface ToolCall {
  id: string;                      // From the JSONL
  turnIndex: number;               // Which turn produced this
  tool: ToolName;
  input: unknown;                  // Raw, tool-specific
  result?: unknown;                // Raw tool result if present
  startedAt: string;
  tMs: number;                     // ms from session start
  fileEditId?: string;             // Set if this produced a FileEdit
}

export type ToolName =
  | 'Edit' | 'MultiEdit' | 'Write'
  | 'Read' | 'Bash' | 'Glob' | 'Grep'
  | 'Task' | 'TodoWrite'
  | string;                        // Permissive for future tools
```

### `FileEdit`

The heart of Pitwall's view. One file change Claude made, with
everything needed to render the row in the Timeline, the diff, and the
Radio panel.

```ts
export interface FileEdit {
  id: string;                      // Stable, derived from toolCallId
  orderIndex: number;              // 0-based, chronological
  toolCallId: string;
  turnIndex: number;

  path: string;                    // Relative to project root
  sector: Sector;                  // Derived from path
  operation: 'Edit' | 'MultiEdit' | 'Write';

  preContent: string | null;       // null if Write created the file
  postContent: string;
  additions: number;               // Added line count
  deletions: number;               // Removed line count
  warnings: FileEditWarning[];     // empty array when none; never undefined

  // The Radio data — spec 04 populates these.
  triggeringUserMessage: string;
  triggeringSentence: Sentence | null;   // null if mapping failed
  thinkingBlocks: string[];              // Empty if none present

  tMs: number;                     // ms from session start
}

export type Sector =
  | 'migrations'
  | 'models'
  | 'controllers'
  | 'views'
  | 'tests'
  | 'config'
  | 'tasks'
  | 'other';

export type FileEditWarning =
  | { code: 'edit_miss'; detail: string }
  | { code: 'multi_edit_partial_miss'; detail: string }
  | { code: 'line_ending_mismatch'; detail: string };
```

> **Note:** `FileEdit.warnings` records non-fatal conditions the
> file-state engine encountered while processing the edit. `detail` is
> a short human-readable string. The codes are:
>
> - `edit_miss` — the `Edit` tool's `old_string` was not found in the
>   current virtual file content. The edit did not apply: `preContent`
>   is `null` and `postContent` is `''`.
> - `multi_edit_partial_miss` — one or more sub-edits of a `MultiEdit`
>   failed to find its `old_string`. `MultiEdit` is atomic, so the
>   whole edit is rejected: `preContent` is `null` and `postContent`
>   is `''`.
> - `line_ending_mismatch` — the file's line endings (CRLF vs LF) do
>   not match what the edit's `old_string` implied. The parser does
>   not silently normalize; the warning surfaces the divergence.
>
> When `edit_miss` and `line_ending_mismatch` both apply to the same
> edit — i.e., the line-ending mismatch is why the string match failed
> — emit both warnings. Do not collapse them.

## Sentence tokenization

The parser must tokenize user messages into sentences so the Radio
panel can highlight the specific sentence that triggered an edit.

- Use a simple, deterministic tokenizer. Do not import an NLP library.
- Split on `.`, `!`, `?` followed by whitespace or end-of-string.
- Preserve sentence boundaries across newlines (paragraph breaks count
  as sentence breaks).
- Record the character offsets so the client can highlight in place.
- Code blocks and inline code inside the prompt are kept intact — do
  not split on periods inside backticks.

Spec 04 defines this in more detail.

## Sector classification

A file's sector is derived from its path using rules that Claude Code
uses broadly across Rails, Django, Express, and similar conventions.
Unknown paths fall through to `other`.

Default rules (in order — first match wins):

| Pattern                               | Sector       |
| ------------------------------------- | ------------ |
| `db/migrate/`, `migrations/`, `*.sql` | migrations   |
| `app/models/`, `models/`              | models       |
| `app/controllers/`, `controllers/`    | controllers  |
| `app/views/`, `views/`, `templates/`  | views        |
| `spec/`, `test/`, `tests/`, `*_test.` | tests        |
| `config/`, `*.yml`, `*.env*`          | config       |
| `lib/tasks/`, `Rakefile`, `*.rake`    | tasks        |
| anything else                         | other        |

The rules are data, not logic — they live in a single table the client
can also read from so labels stay in sync. Spec 13 details how the
client reads this table to drive the Sectors view.

## Pre-state reconstruction

To diff against the pre-session state (not git HEAD), the parser walks
every JSONL record in order and maintains a virtual file map. For each
`Edit`, `MultiEdit`, or `Write`:

1. The current in-memory state of the file becomes `preContent`.
2. Apply the edit.
3. The result becomes `postContent`.
4. Update the virtual file map.

For files read but not written, nothing is tracked. For `Write` that
creates a new file, `preContent` is `null`.

This is what makes Pitwall strictly better than `git diff` for session
review: it knows the actual sequence of intermediate states, not just
net change.
