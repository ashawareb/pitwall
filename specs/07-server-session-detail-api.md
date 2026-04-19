# Spec 07 · server-session-detail-api

## Purpose

Implement the endpoints that return a full session for review:

- `GET /api/projects/:hash/sessions/:id`
- `GET /api/projects/:hash/sessions/:id/files/:editId`
- `GET /api/projects/:hash/sessions/:id/replay/:tMs`

## Dependencies

Spec 06 must be complete.

## Scope

- Session detail: full parsed `Session` with all `fileEdits` including
  the Radio data. File contents **not** inlined — the client fetches
  per-file content through the files endpoint.
- File contents: pre/post content plus a language hint derived from
  extension.
- Replay: the reconstructed file map at a specific `tMs`.
- Same mtime-keyed cache strategy as spec 06.

## Acceptance criteria

- All three endpoints return JSON matching `docs/03-api-contract.md`.
- Session detail excludes `preContent` and `postContent` from the main
  payload (too heavy). Each edit carries only a stable `id` plus the
  metadata needed to render timeline/sectors/radio rows.
- Language detection: `.rb` → `ruby`, `.ts`/`.tsx` → `typescript`,
  `.js`/`.jsx` → `javascript`, `.py` → `python`, `.sql` → `sql`,
  `.yml`/`.yaml` → `yaml`, `.json` → `json`, `.md` → `markdown`,
  `.html` → `html`, `.css` → `css`, else `text`. Expand as needed.
- Replay at `tMs = 0` returns the initial state (every file either
  absent or seeded by a Read before any edit).
- Replay at `tMs >= session.durationMs` returns the final state.
- 404s are returned with documented error codes.
- Performance, covering both spec 06 and spec 07 endpoints, measured
  against a synthetic 100-session fixture:
  - `GET /api/projects`: under 1 second cold, under 100 ms warm.
  - `GET /api/projects/:hash/sessions`: under 1 second cold, under
    100 ms warm.
  - `GET /api/projects/:hash/sessions/:id`: under 200 ms cold, under
    20 ms warm (full parser pipeline is heavier than a metadata pass,
    hence the looser cold budget; the warm budget is tighter because
    the cache serves a reconstructed `Session`).
  - `GET /api/projects/:hash/sessions/:id/files/:editId`: under 50 ms
    warm (pure `Map` lookup against the cached `Session`).
  - `GET /api/projects/:hash/sessions/:id/replay/:tMs`: under 200 ms
    cold, under 50 ms warm (snapshot computation per request, with
    `(sessionId, tMs)` memoization per the Notes).
- At least 6 integration tests covering all three endpoints plus
  edge cases (replay boundaries, unknown edit id).

## Files to create / modify

- `packages/server/src/routes/session-detail.ts`
- `packages/server/src/routes/session-file.ts`
- `packages/server/src/routes/session-replay.ts`
- `packages/server/src/lang.ts` (language detection)
- `packages/server/src/server.ts` (wire routes)
- `packages/server/test/session-detail.test.ts`
- `packages/server/test/session-file.test.ts`
- `packages/server/test/session-replay.test.ts`

## Notes

- The replay endpoint can be expensive for long sessions. Memoize by
  `(sessionId, tMs)` with a small LRU (size 10 per session).
- Language detection is not smart. Don't try to look at file contents.
- Spec 06's AC #7 ("listing 100 sessions should complete in under
  1 second cold, under 100 ms warm") was design-verified but not
  empirically benchmarked during the spec 06 session. It is considered
  satisfied by the performance acceptance criterion above — the shared
  100-session fixture and its `GET /api/projects` /
  `GET /api/projects/:hash/sessions` targets exercise the same code
  paths. No separate spec 06 amendment is needed.

## Do not

- Do not stream responses. JSON bodies are fine even when large.
- Do not compress. Fastify can do that transparently if we enable it
  later. Not now.
- Do not add a "watch" mode that pushes updates. v1 is request-reply.
