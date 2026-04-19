# Spec 12 · client-radio-panel

## Purpose

Implement the right rail: the Radio panel showing the user's prompt
(with the triggering sentence highlighted) and Claude's thinking
blocks that preceded the selected edit.

This is Pitwall's signature feature. Get it right.

## Dependencies

Specs 10 and 11 must be complete.

## Scope

- On selection of a file edit (or a chunk within it), read the
  `triggeringUserMessage`, `triggeringSentence`, and `thinkingBlocks`
  from the edit object in the session payload.
- Render the panel top-to-bottom per `docs/04-ui-system.md` § Radio:
  1. `RADIO` label with live dot
  2. `↓ PROMPT` section — the full user message, with the triggering
     sentence highlighted inline
  3. `↑ THINKING` section — all thinking blocks concatenated, rendered
     italic and muted
  4. `0.5px` separator
  5. Metadata rows: `TOOL`, `TURN`, `T+`
- Sentence highlight: overlay `--pw-accent-soft` background + 1px
  inset `--pw-accent` shadow on the exact character range of the
  `triggeringSentence`. Preserve the surrounding text exactly.
- If `triggeringSentence` is `null`, render the prompt with no
  highlight and a small note: `(no sentence match — review full prompt)`.
- If `thinkingBlocks` is empty, render `(no reasoning captured)` in
  `--pw-fg-faint` italic.
- Multiple thinking blocks: render each in its own `<p>` with paragraph
  spacing. No numbering, no headings.
- Very long thinking blocks: no truncation in v1. Let the panel scroll.
- Metadata:
  - `TOOL` → `toolCall.tool`
  - `TURN` → `turnIndex + 1` / `session.turns.length`
  - `T+` → `fileEdit.tMs` formatted as `Nm Ns` (e.g., `2m 14s`).
    For sub-minute, `N.Ns`.

## Acceptance criteria

- Panel renders correctly when all Radio data is present.
- Panel renders gracefully when any field is missing/empty.
- Sentence highlight appears at exactly the right character range.
  Hand-test with edits that map to sentences at start, middle, and
  end of a prompt.
- Panel updates on chunk selection change from the diff view.
- Panel width is 180px; content wraps correctly within it.
- Italic rendering is applied only to thinking blocks, never to
  prompt text.
- At least 4 component tests covering: full data, missing sentence,
  missing thinking, multi-paragraph thinking.

## Files to create / modify

- `packages/client/src/components/RadioPanel.tsx` (new)
- `packages/client/src/components/SentenceHighlight.tsx` (new — the
  precise-range text rendering)
- `packages/client/src/components/MetaRow.tsx` (new)
- `packages/client/src/utils/relative-time.ts` (modified) — add formatTPlus export alongside existing formatDuration.
- `packages/client/src/routes/Session.tsx` (wire RadioPanel)
- `packages/client/test/RadioPanel.test.tsx` (new)
- `packages/client/test/SentenceHighlight.test.tsx` (new)

## Notes

- The sentence highlight must not break word wrapping. Use a `<span>`
  with the precise char range and inline background, not a block
  element.
- Thinking blocks can contain newlines. Preserve them with
  `white-space: pre-wrap`.
- Do not parse markdown inside prompt or thinking. Show as text.
- The `↓` and `↑` arrows are `--pw-accent` color, `font-size: 11px`,
  sitting to the left of the section labels.

## Do not

- Do not render the scrubber here. Spec 14.
- Do not implement the Sectors view here. Spec 13.
- Do not fetch anything extra — Radio data is already in the session
  payload from spec 07.
- Do not offer a "copy prompt" button in v1. The browser's native
  text selection is enough.
