# 03 · API contract

The server exposes a small REST API on `http://localhost:<port>`. All
responses are JSON. All endpoints are side-effect free (read-only).

## Versioning

- The API is unversioned in v1. If any breaking change is needed, add
  `/api/v2/` paths and keep `/api/v1/` alive for one release.
- Every response includes a `X-Pitwall-Api: 1` header.

## Conventions

- Success: HTTP 200 with a JSON body.
- Client error: HTTP 4xx with `{ error: string, code: string }`.
- Server error: HTTP 500 with `{ error: string, code: string }`. Never
  leak stack traces in the body.
- Pagination: none in v1. Lists return everything. If a session has
  500 file edits, we send all 500.

## Endpoints

### `GET /api/health`

Returns `{ ok: true, version: string, apiVersion: 1 }`. Used by the
client to verify the server is up before rendering.

### `GET /api/projects`

Lists all discovered projects under `~/.claude/projects/`.

Response:

```ts
{
  projects: Array<{
    hash: string;
    path: string;                         // Decoded absolute path
    pathSource: 'cwd' | 'hash-decoded';   // See note below
    sessionCount: number;
    lastActivityAt: string;               // ISO, latest session end
  }>;
}
```

Order: most recently active first.

> **Note on `pathSource`.** `projectHash()` is a one-way, lossy encoding:
> it collapses both `/` and `.` to `-`, so the hash cannot be decoded
> unambiguously. When `pathSource` is `cwd`, the `path` field was read
> from a session record's `cwd` field and is authoritative. When
> `pathSource` is `hash-decoded`, the project has no readable sessions
> yet, so the server fell back to a naive `-` → `/` reverse of the hash.
> Treat `hash-decoded` paths as approximate.

> **Note on `lastActivityAt`.** When a project has no readable sessions,
> `lastActivityAt` falls back to the project directory's mtime.

### `GET /api/projects/:hash/sessions`

Lists sessions for one project. The hash in the URL must exist.

Response:

```ts
{
  projectHash: string;
  projectPath: string;
  sessions: Array<{
    id: string;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    firstPrompt: string;    // Truncated to ~200 chars
    fileCount: number;
    toolCallCount: number;
    sectorSummary: SectorCounts;
  }>;
}
```

Order: most recent first (by `endedAt`).

### `GET /api/projects/:hash/sessions/:id`

Full detail for one session. This is the main payload the client
renders.

Response: a full `Session` object as defined in
`docs/02-data-model.md`, plus an embedded `fileEdits` array with
everything needed to render the Timeline, Sectors, and Radio views
without any further round-trips.

Large responses are fine. Do not paginate in v1.

### `GET /api/projects/:hash/sessions/:id/files/:editId`

Returns the full pre/post content for a specific file edit, so the
client can render the diff without sending every file's content in the
session payload.

Response:

```ts
{
  editId: string;
  path: string;
  preContent: string | null;
  postContent: string;
  language: string;        // For Shiki — derived from extension
}
```

### `GET /api/projects/:hash/sessions/:id/replay/:tMs`

Returns the reconstructed file state of the entire project at a
specific point in the session (in milliseconds from start). Powers the
Lap Replay scrubber.

Response:

```ts
{
  tMs: number;
  files: Array<{
    path: string;
    content: string;        // State at tMs
    lastEditedTMs: number;  // When this file was last touched before tMs
  }>;
}
```

Implementation note: the parser builds the virtual file map during
parsing. The server can snapshot it at any tMs by replaying edits up
to that point. For v1, compute on request; cache if it becomes a
bottleneck.

## CORS

- Allow `http://localhost:*` origins.
- No credentials (`Access-Control-Allow-Credentials: false`).
- Standard headers allowed: `Content-Type`, `Accept`.

## Errors

Error codes the client should handle:

| Code                | Meaning                                        |
| ------------------- | ---------------------------------------------- |
| `project_not_found` | Unknown project hash                           |
| `session_not_found` | Unknown session id                             |
| `edit_not_found`    | Unknown edit id within a session               |
| `invalid_tMs`       | Replay `tMs` path param was not a non-negative safe integer (HTTP 400) |
| `parse_error`       | JSONL malformed or schema-invalid              |
| `io_error`          | File system read failed                        |
| `internal`          | Uncategorized — should never happen, log loud  |

The client renders `parse_error` with a link to file an issue and the
file path (the user's local path is safe — nothing leaves their
machine).
