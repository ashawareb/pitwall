# Spec 04 · parser-intent-and-thinking

## Purpose

Populate the Radio data on every `FileEdit`: the triggering user
message, the specific sentence within it most likely to have caused
this edit, and any thinking blocks from the assistant turn that
preceded the tool call.

This spec is what makes Pitwall's Radio panel work.

## Scope

- For each `FileEdit`, find the `Turn` that produced it.
- Set `triggeringUserMessage` to the full text of the turn's user
  message.
- Extract all `thinking` blocks from the turn's assistant blocks that
  appeared **before** the `tool_use` that produced the edit. Store as
  `thinkingBlocks: string[]`.
- Map the edit to a specific `Sentence` in the user message using a
  scoring function. If scoring can't confidently pick a sentence,
  return `null`.

## Dependencies

Spec 03 must be complete.

## Acceptance criteria

- Every `FileEdit` in `Session.fileEdits` has:
  - `triggeringUserMessage: string` — non-empty, equal to the user
    message of the parent turn
  - `triggeringSentence: Sentence | null`
  - `thinkingBlocks: string[]` — empty array if no thinking blocks
- Scoring function:
  - Input: a `Sentence[]` (the user's tokenized message) plus the edit's
    file path, operation, `postContent`, and the tool_use input.
  - Output: a `Sentence | null`.
  - Strategy: token overlap between the sentence and (path + operation
    verb + keywords extracted from a 200-char scoring snippet), weighted
    by position (earlier sentences preferred on ties).
  - Scoring snippet: normally the first 200 chars of `postContent`. When
    `postContent === ''` — i.e. the spec-03 file-state engine rejected
    the edit (`edit_miss` or `multi_edit_partial_miss`) — fall back to
    the AI's intended content from the tool_use input: `new_string` for
    `Edit`, the newline-joined concatenation of every sub-edit's
    `new_string` for `MultiEdit`. `Write` has no fallback; its
    `postContent` is empty only in degenerate cases (e.g. writing an
    empty file), and the empty snippet is the literal intent. Rationale:
    `new_string` captures what the AI tried to write, which is still
    meaningful signal for intent matching even when the edit did not
    apply.
  - If the best score is below a threshold, return `null`.
- The scoring threshold, weights, and keyword extraction rules live
  in `packages/parser/src/intent.ts` and are tunable without touching
  callers.
- Thinking extraction handles turns where thinking is absent (empty
  array, no error).
- Thinking extraction handles turns where multiple thinking blocks
  interleave with text blocks — preserve their order.
- At least 6 unit tests covering: confident match, ambiguous match
  (returns null), no thinking, one thinking block, multiple thinking
  blocks, and thinking that comes *after* the tool_use (ignored).

## Files to create / modify

- `packages/parser/src/intent.ts` (new)
- `packages/parser/src/thinking.ts` (new)
- `packages/parser/src/session.ts` (modify to call both)
- `packages/parser/src/index.ts` (add exports)
- `packages/parser/test/intent.test.ts` (new)
- `packages/parser/test/thinking.test.ts` (new)

## Notes

- The scoring is heuristic and can be wrong. That's okay — the Radio
  panel always shows the full user message regardless, and the
  highlighted sentence is a hint, not a proof.
- Keep the keyword extraction simple. A regex that pulls quoted
  strings, camelCase identifiers, and file-extension-like tokens is
  enough for v1.
- Thinking blocks may be large. Do not truncate here; the client
  decides how to render.

## Do not

- Do not ship any model-based scoring or API calls. The parser must
  remain offline, synchronous, and deterministic.
- Do not modify schemas from spec 01 unless absolutely necessary.
- Do not rely on the scoring to be always correct. Provide `null`
  gracefully.
