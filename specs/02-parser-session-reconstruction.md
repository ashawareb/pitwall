# Spec 02 · parser-session-reconstruction

## Purpose

Turn a stream of validated `SessionRecord`s into `Session`, `Turn`, and
`ToolCall` objects as defined in `docs/02-data-model.md`. Preserve
chronological order exactly.

## Scope

- A `reconstructSession(records: AsyncIterable<SessionRecord>)`
  function that returns a `Promise<Session>`.
- Group records into Turns (a user message + the assistant's response
  to it).
- Extract tool calls from assistant messages, preserving order.
- Tokenize user messages into sentences with char offsets (per
  `docs/02-data-model.md` § Sentence tokenization).
- Classify each file operation's sector from the path using the table
  in `docs/02-data-model.md`.

## Dependencies

Spec 01 must be complete.

## Prerequisites from spec 01

Two shapes from spec 01 that this spec depends on:

- `SessionRecord` is a TypeScript union plus a `parseSessionRecord`
  dispatcher — not a Zod `discriminatedUnion`. Consume the dispatcher's
  output. Do not reach for a `SessionRecordSchema` combinator; there
  isn't one.
- The raw thinking block carries `thinking: string`. The normalized
  `AssistantBlock` in `docs/02-data-model.md` is
  `{ type: 'thinking'; text: string }`. Spec 02 performs the
  `thinking → text` field rename during normalization.

## Acceptance criteria

- `reconstructSession` consumes the async generator from spec 01 and
  returns a valid `Session`.
- Turns are in input order. Tool calls within a turn are in input order.
- Sentence tokenization:
  - Splits on `.`, `!`, `?` followed by whitespace or EOS
  - Preserves character offsets (inclusive start, exclusive end)
  - Does not split inside backtick code
  - Treats paragraph breaks (`\n\n`) as sentence boundaries
- Sector classification uses a single table exported as
  `SECTOR_RULES` so the client can reuse it later.
- `Session.firstPrompt` is the first user message's text truncated to
  200 chars with `…` if truncated.
- `sectorSummary` is correctly populated (counts of file paths per
  sector across all `fileEdits`).
- `startedAt`, `endedAt`, `durationMs` are accurate.
- At least 8 unit tests covering: empty session, one-turn session,
  multi-turn session, sentence tokenization edge cases, sector
  classification for each sector, and malformed input rejection.

## Files to create / modify

- `packages/parser/src/session.ts` (new)
- `packages/parser/src/tokenizer.ts` (new)
- `packages/parser/src/sectors.ts` (new, exports `SECTOR_RULES` and
  `classifySector(path): Sector`)
- `packages/parser/src/index.ts` (add exports)
- `packages/parser/test/session.test.ts` (new)
- `packages/parser/test/tokenizer.test.ts` (new)
- `packages/parser/test/sectors.test.ts` (new)
- `packages/parser/test/fixtures/multi-turn.jsonl` (new)

## Notes

- `fileEdits` is populated here but with empty `preContent`/`postContent`
  and zero `additions`/`deletions`. Spec 03 will fill those.
- `triggeringUserMessage`, `triggeringSentence`, and `thinkingBlocks`
  are populated in spec 04.
- For now, leave those fields at their documented defaults.

## Do not

- Do not implement file-state reconstruction. That is spec 03.
- Do not implement intent/thinking mapping. That is spec 04.
- Do not import an NLP library for sentence splitting. Hand-write it.
- Do not hardcode sector paths outside `sectors.ts`.
