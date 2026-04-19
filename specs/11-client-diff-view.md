# Spec 11 · client-diff-view

## Purpose

Render the middle panel: the syntax-highlighted diff for the
currently-selected file edit.

## Dependencies

Specs 07 and 10 must be complete.

## Scope

- On selection change, fetch
  `/api/projects/:hash/sessions/:id/files/:editId` and render the diff.
- Use Shiki for syntax highlighting with a custom theme matching the
  `--pw-*` tokens in `docs/04-ui-system.md`.
- Unified diff rendering:
  - Line numbers on the left, `--pw-fg-ghost`.
  - Added lines: `--pw-diff-add-bg` with `--pw-accent` left border.
  - Removed lines: `--pw-diff-del-bg` with `--pw-error` left border.
  - Hunks collapsed with a small chevron and `… N unchanged lines …`
    label; expandable on click.
- Header row: `NN · path/to/file.ext` on the left, `+N −M` on the right.
- Click on a diff chunk sets the "selected chunk" state that the
  Radio panel (spec 12) consumes. Selected chunk gets a brighter inset
  shadow per `docs/04-ui-system.md`.
- Initial selection: the first added chunk in the file.
- New files (preContent null): show the whole file as a single add
  block, no collapsed hunks.
- Deleted files: not possible in Pitwall's current scope (no delete
  tool is tracked). If it happens, render an empty panel with a note.

## Acceptance criteria

- Diff renders for Ruby, TypeScript, Python, YAML, SQL, and Markdown
  at minimum (other languages fall back to plaintext highlighting).
- Theme colors exactly match the tokens.
- Performance: a 500-line diff renders within 300ms on warm load.
- Long lines wrap or horizontally scroll (decide based on vibe; prefer
  scroll for code).
- Click → selected chunk state flows to the Radio panel correctly.
- At least 3 component tests covering: render Ruby diff, expand
  collapsed hunk, click chunk selection.

## Files to create / modify

- `packages/client/src/components/DiffView.tsx` (new)
- `packages/client/src/components/DiffLine.tsx` (new)
- `packages/client/src/components/DiffHunk.tsx` (new)
- `packages/client/src/lib/shiki.ts` (theme + lazy-init)
- `packages/client/src/lib/diff-chunks.ts` (chunking algorithm)
- `packages/client/src/hooks/useFileContent.ts` (new — fetch + cache)
- `packages/client/src/hooks/useSelectedChunk.ts` (new)
- `packages/client/test/DiffView.test.tsx` (new)
- `packages/client/test/diff-chunks.test.ts` (new)

## Notes

- Shiki's full bundle is large. Load it lazily and only the languages
  Pitwall supports. Use `shiki/bundle/web` or equivalent.
- Chunking: group adjacent added/removed lines into "chunks". Each
  chunk has an id derived from file path + start line so selection
  state survives re-renders.
- Do not use `diff2html` or any rendering library. Own the markup.

## Do not

- Do not implement the Radio panel here. Spec 12.
- Do not support split view in v1.
- Do not offer a "view raw" toggle. Always show the diff.
- Do not save view settings (theme, wrap) to disk or localStorage —
  Pitwall is stateless.
