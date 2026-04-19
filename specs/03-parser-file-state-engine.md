# Spec 03 · parser-file-state-engine

## Purpose

Reconstruct the pre- and post-content of every file edit by replaying
tool calls in order through a virtual file map. This is what makes
Pitwall strictly better than `git diff` for session review.

## Scope

- A `VirtualFileMap` class that holds the current in-memory content
  of every file touched during a session.
- A function that, given a `ToolCall` with a recognized file-edit tool
  (`Edit`, `MultiEdit`, `Write`) plus the current map, returns the
  `{ preContent, postContent }` pair and updates the map.
- Diff-line counting: produce `additions` and `deletions` per edit by
  line-diffing pre against post.
- Handle the `Read` tool as a no-op that still records the file content
  the agent saw (optional seed for the virtual map — this helps when
  the first `Edit` refers to a file the parser hasn't seen created).

## Dependencies

Spec 02 must be complete.

## Acceptance criteria

- `reconstructSession` from spec 02 is extended to run the file-state
  engine and populate `preContent`, `postContent`, `additions`,
  `deletions` on every `FileEdit`.
- `Edit` tool calls:
  - If `old_string` is found in the current content, replace and record.
  - If `old_string` is not found, the edit did not apply. Mark the edit
    with `preContent: null` and `postContent: ''`, and append
    `{ code: 'edit_miss', detail }` to the edit's
    `warnings: FileEditWarning[]`. Do not throw. Do not surface the
    tool_result's error text as `postContent` — it is not the file's
    post-state.
- `MultiEdit`: MultiEdit is atomic. Apply all sub-edits in order;
  if any sub-edit fails to find its `old_string`, reject the entire
  MultiEdit: `preContent: null`, `postContent: ''`, and append a
  single `{ code: 'multi_edit_partial_miss', detail }` entry to the
  edit's `warnings: FileEditWarning[]` (detail identifies the
  failing sub-edit, e.g. "sub-edit 2 of 5: old_string not found").
  Do not partially apply. Do not surface the tool_result's error
  text as `postContent`.
- `Write`: if file did not exist in the virtual map, `preContent` is
  `null`. Otherwise `preContent` is the current content.
- `Read`: seeds the virtual map with the read content if not already
  present.
- `additions` and `deletions` are exact line counts from a line-level
  diff between `preContent ?? ''` and `postContent`.
- `FileEdit.orderIndex` is set in chronological order starting at 0.
- At least 9 unit tests covering: Edit-hit, Edit-miss (asserts
  `preContent` null, `postContent` empty, and `edit_miss` warning
  emitted with detail), MultiEdit all-hit, MultiEdit partial-miss
  (asserts the whole edit is rejected with `preContent` null,
  `postContent` empty, and `multi_edit_partial_miss` warning),
  Write-new, Write-overwrite, `line_ending_mismatch` warning
  emission, dual-emission (`edit_miss` AND `line_ending_mismatch`
  co-occurring on the same edit), and diff line counting.

## Files to create / modify

- `packages/parser/src/file-state.ts` (new)
- `packages/parser/src/diff.ts` (new — tiny line-diff implementation)
- `packages/parser/src/session.ts` (modify to call file-state engine)
- `packages/parser/test/file-state.test.ts` (new)
- `packages/parser/test/diff.test.ts` (new)

## Notes

- Use a tiny hand-written LCS-based line diff. Do not pull in a diff
  library for this count (it's a few dozen lines).
- The real rendering diff is done client-side with a proper library
  (spec 11). This engine only produces counts.
- Do not normalize line endings silently. Preserve what's in the file.
  Record CRLF vs LF mismatches by appending
  `{ code: 'line_ending_mismatch', detail }` to the edit's
  `warnings: FileEditWarning[]`. See `docs/02-data-model.md § FileEdit`
  for the full warning semantics, including the dual-emission rule when
  a line-ending mismatch is also the cause of an `edit_miss`. When both
  apply, emit `edit_miss` first and `line_ending_mismatch` second — the
  miss is the primary observable outcome (the file did not change) and
  the mismatch is its diagnostic explanation.

## Do not

- Do not implement intent/thinking mapping. That is spec 04.
- Do not try to handle Bash edits (they mutate disk but are not
  tracked by Pitwall).
- Do not compress or dedupe content. Memory is fine for v1.
