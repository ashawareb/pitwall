# Spec 06 · server-sessions-api

## Purpose

Implement `GET /api/projects` and `GET /api/projects/:hash/sessions`
on the server, backed by the parser. These are the list endpoints
the session picker uses.

## Scope

- Discover Claude Code projects by scanning
  `~/.claude/projects/<hash>/` directories.
- For each project, list its `.jsonl` files as sessions.
- Parse session metadata cheaply (first prompt, start/end times, file
  count, sector summary) without fully parsing every record — use a
  fast pass if possible.
- Cache parsed metadata per file with mtime-based invalidation.
- Expose the two endpoints per `docs/03-api-contract.md`.

## Dependencies

Spec 05 must be complete.

## Acceptance criteria

- `GET /api/projects` returns every project under `~/.claude/projects/`,
  ordered by most recently active.
- `GET /api/projects/:hash/sessions` returns every session for that
  project, ordered by most recent `endedAt` first.
- Both endpoints return typed JSON matching the shapes in
  `docs/03-api-contract.md`.
- `project_not_found` (404) is returned for unknown hashes.
- The project path in responses is the decoded absolute path (Claude
  Code encodes `/` as `-` in the hash — decode it).
- Metadata caching:
  - First request parses; subsequent requests within the same mtime
    hit the cache.
  - Cache is in-memory only (no disk write).
- Performance: listing 100 sessions should complete in under 1 second
  cold, under 100 ms warm.
- At least 5 integration tests covering: empty projects dir, one
  project / one session, one project / many sessions, unknown project
  hash, cache hit vs miss.

## Files to create / modify

- `packages/server/src/fs/claude-home.ts` (resolves `~/.claude`,
  overridable via `PITWALL_CLAUDE_HOME` env var for tests)
- `packages/server/src/fs/discover.ts` (project + session discovery)
- `packages/server/src/cache.ts` (mtime-keyed memo)
- `packages/server/src/routes/projects.ts`
- `packages/server/src/routes/sessions.ts`
- `packages/server/src/server.ts` (wire routes)
- `packages/server/test/projects.test.ts`
- `packages/server/test/sessions.test.ts`
- `packages/server/test/fixtures/claude-home/` (sample projects dir)

## Notes

- `PITWALL_CLAUDE_HOME` env var points the server at an alternate
  directory. This is how tests work. Default is `~/.claude`.
- Hash decoding: Claude Code replaces `/` with `-` in the project path.
  Reverse that. Be tolerant of double-dashes that are really paths
  with hyphens (try both).

## Do not

- Do not implement the session detail endpoint. That is spec 07.
- Do not fully parse every session for the list endpoint — it's too
  slow. Parse just enough for the metadata.
- Do not watch the file system for changes. v1 is read-on-request.
