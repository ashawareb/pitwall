# CLAUDE.md — Pitwall

This file is read at the start of every Claude Code session. It defines
the non-negotiable rules for working in this repo.

---

## 1. Model

**You must be running on Opus 4.7.** No exceptions.

At the start of every session, confirm the model you are running. If you
are not on Opus 4.7, stop and tell the user. Do not proceed with
Sonnet, Haiku, or any earlier Opus version.

At the end of every session, state which model you used during the
session. If it changed mid-session, say so.

Why: quality drift has been observed when implementation spans multiple
models or earlier versions. Pitwall is too detail-sensitive to tolerate
that.

---

## 2. The spec is the source of truth

Pitwall is built from 15 atomic specs in `specs/01-*.md` through
`specs/15-*.md`. Each spec is implemented in a separate Claude Code
session. No exceptions.

- The spec describes *what* to build and *why*.
- You decide *how*, within the spec's constraints.
- If the spec is unclear or wrong, stop and ask. Do not improvise.
- Spec changes are a separate session. See `prompts/session-start.md § 4`.

If you find yourself wanting to build something outside the current
spec's scope — even if it would "clearly help" — stop. Either (a) it
belongs in a different spec and will be built there, or (b) the spec
needs to be amended. Both are valid. Improvising in the current session
is not.

---

## 3. The A→F cycle

Every spec session follows this cycle. No exceptions.

- **A — Analyze.** Read the spec. Read every doc the spec depends on.
  Read the relevant existing code. State what you understand. Do not
  write code yet.
- **B — Blueprint.** Propose an implementation plan. List every file
  you will create or modify. List every test you will write. Call out
  anything you are uncertain about. Wait for the user to say `go`.
- **C — Code.** Execute the plan. Nothing more, nothing less.
- **D — Diff.** Present the full diff. Summarize what changed.
- **E — Evaluate.** Run the project's checks: `pnpm build`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`. All must pass.
- **F — Finalize.** Commit with the prescribed format. State
  "Spec N complete. Open a fresh session for spec N+1." Stop.

Every phase boundary (B, D, E, F) requires a new user turn before
proceeding. "Proceed to X" or "go" authorizes phase X only, never
the phases that follow.

If step E fails, return to C. Do not commit broken code. Do not commit
with warnings silenced.

After F's commit, run the end-of-session check from
`prompts/session-start.md § 5` and surface its answers without waiting
to be asked — the "Spec N complete" announcement marks §5's completion,
not the commit's. Address anything §5 surfaces before announcing.

---

## 4. Foundational docs

Before every session, read:

1. `docs/00-overview.md` — what Pitwall is and who it's for
2. `docs/01-architecture.md` — monorepo layout and package
   responsibilities
3. `docs/02-data-model.md` — the core types every package shares
4. `docs/03-api-contract.md` — server ↔ client interface
5. `docs/04-ui-system.md` — design tokens and visual language

Plus the spec for the current session.

If any of these docs conflict with each other or with the spec, stop
and flag the conflict. Do not pick a side silently.

---

## 5. Code standards

- **Language:** TypeScript, `strict: true`. No `any` without a
  one-line `// reason:` comment. The same rule applies to `as` type
  assertions in non-test code: prefer a type guard or `in` narrowing
  when the type system can express the guarantee, and only fall back
  to `as` with a `// reason:` line. (`as const` is a const assertion,
  not a type assertion — it's not covered by this rule.) Test
  fixtures may use `as` freely to construct partial records.
- **Runtime:** Node 20+
- **Package manager:** pnpm (workspaces). When a new dependency requires a
  postinstall/lifecycle script (typically native bindings — esbuild, sharp,
  better-sqlite3, etc.), allowlist it explicitly by name in the root
  `package.json`'s `pnpm.onlyBuiltDependencies` array. Do **not** blanket-approve
  via `pnpm approve-builds`. Each addition is a deliberate decision recorded in
  the diff.
- **Style:** Prettier defaults, ESLint with `@typescript-eslint`
- **Tests:** Vitest. Every parser function needs a unit test. Every
  API endpoint needs an integration test. UI components need at least
  one smoke test.
- **No console.log in shipped code.** Use a logger.
- **No dead code.** If you wrote a helper and don't use it, delete it
  before the commit.
- **No TODOs without tickets.** If you defer something, the spec must
  be updated with a follow-up task, or a new spec filed.

---

## 6. Commit discipline

- One commit per spec. Squash your working commits at the end.
- Commit message format:
  ```
  feat(spec-NN): <one-line summary>

  <optional body explaining the change in 1-3 lines>

  Spec: specs/NN-<spec-name>.md
  ```
- Example:
  ```
  feat(spec-01): parser JSONL reader with Zod validation

  Adds @pitwall/parser package with a streaming JSONL reader. Validates
  every line against the Claude Code session schema and emits typed
  records.

  Spec: specs/01-parser-jsonl-reader.md
  ```

---

## 7. What "done" means

A spec is done when all five are true:

1. Every acceptance criterion in the spec is met.
2. All checks pass (`build`, `typecheck`, `lint`, `test`).
3. The commit is made with the prescribed message.
4. §5 end-of-session check has been run and surfaced to the user;
   any issues raised are addressed.
5. You have told the user "Spec N complete. Open a fresh session for
   spec N+1" and stopped.

If any of the five is not true, the spec is not done.

---

## 8. When in doubt

Stop. Ask. The cost of a clarifying question is minutes. The cost of
shipping the wrong thing is days.

The user would rather you ask three unnecessary questions than improvise
once.
