# Spec 01 · parser-jsonl-reader

## Purpose

Build the `@pitwall/parser` package and its streaming JSONL reader.
This is the foundation of every downstream package. Zero dependencies
on server or client.

## Scope

- Set up the monorepo skeleton: root `package.json`, `pnpm-workspace.yaml`,
  `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc`, and the four
  empty package directories.
- Create `packages/parser` with `tsup`, `vitest`, and `zod`.
- Implement a streaming line reader for JSONL files.
- Define Zod schemas for the record shapes Claude Code writes.
- Export a `readSessionRecords(filepath: string)` async generator that
  yields one validated record at a time.

## Dependencies

None. This is spec 01.

## Acceptance criteria

- `pnpm install` at the repo root succeeds with zero warnings.
- `pnpm -F @pitwall/parser build` produces ESM, CJS, and `.d.ts`.
- `pnpm -F @pitwall/parser typecheck` passes in strict mode.
- `pnpm -F @pitwall/parser test` passes.
- The reader handles:
  - UTF-8 BOM at the start of a file
  - Trailing blank lines
  - Lines longer than 1 MB (streaming, no full-file buffer)
  - Invalid JSON on a line: throw `ParseError` with line number
  - Valid JSON that fails Zod: throw `SchemaError` with line number
    and Zod issues
- Schemas exist and are exported for: `UserMessageRecord`,
  `AssistantMessageRecord`, `ToolUseBlock`, `TextBlock`, `ThinkingBlock`,
  `ToolResultBlock`, and a top-level discriminated union
  `SessionRecord`.
- At least 6 unit tests, including fixtures of real-looking records.
- Fixtures live in `packages/parser/test/fixtures/*.jsonl` — small
  hand-crafted files. Do not commit real user sessions.

## Files to create

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.eslintrc.cjs`
- `.prettierrc`
- `.gitignore`
- `packages/parser/package.json`
- `packages/parser/tsconfig.json`
- `packages/parser/tsup.config.ts`
- `packages/parser/vitest.config.ts`
- `packages/parser/src/index.ts`
- `packages/parser/src/reader.ts`
- `packages/parser/src/schema.ts`
- `packages/parser/src/errors.ts`
- `packages/parser/test/reader.test.ts`
- `packages/parser/test/schema.test.ts`
- `packages/parser/test/fixtures/*.jsonl` (at least 3)

## Notes

- The JSONL schema evolves. Be permissive with `.passthrough()` on
  unknown keys, but strict on required ones. Record every schema
  assumption in a comment next to the schema definition.
- Use `readline` with a `fs.createReadStream` — do not `fs.readFileSync`
  the whole file.
- Do not import anything from `server`, `client`, or `cli`.

## Do not

- Do not implement session reconstruction. That is spec 02.
- Do not implement file-state reconstruction. That is spec 03.
- Do not implement intent or thinking extraction. That is spec 04.
- Do not add a CLI bin here.
- Do not import the real user's JSONL files for testing. Hand-craft
  fixtures.
- Do not commit `any` types without a `// reason:` comment.
