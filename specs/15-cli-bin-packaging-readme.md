# Spec 15 · cli-bin-packaging-readme

## Purpose

Ship it. Build the `pitwall` CLI, bundle the client into it, wire up
npm publishing, write the public README, and run an end-to-end smoke
test against a real Claude Code session.

## Dependencies

Specs 01 through 14 must be complete.

## Scope

### CLI (`packages/cli`)

- Entry point: `packages/cli/src/bin.ts` with a shebang.
- Flags:
  - No args: use current working directory, auto-detect project.
  - `--all`: show all projects (navigate to project list).
  - `--session <uuid>`: deep-link to a specific session.
  - `--port <n>`: pin the server port.
  - `--no-open`: skip opening the browser.
  - `--help`, `--version`: standard.
- Hash the current working directory the same way Claude Code does.
- Start `@pitwall/server` with the bundled client dist as the static
  root.
- Open the default browser with the correct URL (unless `--no-open`).
- Trap SIGINT/SIGTERM and shut the server down.
- Banner on start:
  ```
     ███  PITWALL  0.1.0
     ─────────────────────────────
     Reviewing: ~/code/myapp
     URL:       http://localhost:4317
     Quit:      Ctrl-C
  ```

### Bundling

- CLI build: `tsup` produces an ESM binary with Node shebang.
- Client build: `vite build` → static assets.
- CLI's build step copies `packages/client/dist/` into
  `packages/cli/dist/static/`.
- Server serves `dist/static/` as the root when no API path matches.
- Final `packages/cli/dist/` is self-contained and shippable.

### npm packaging

- Package name: `pitwall` if available on npm, else `@pitwall-cc/cli`.
  Check at spec execution time.
- `bin` field points to the built `bin.js`.
- `files` field includes `dist/` only.
- `engines` field requires Node 20+.
- `keywords`: `claude`, `claude-code`, `code-review`, `ai-review`,
  `agent-review`, `pitwall`.
- A `postinstall` note in README warns that Pitwall reads
  `~/.claude/projects/` and makes no network calls.

### README

Write `README.md` at the repo root. Sections, in order:

1. Hero line + logo (embed `brand/svg/pitwall-logo.svg`)
2. One-sentence pitch (from `docs/00-overview.md`)
3. One-paragraph problem statement
4. Install: `npm i -g pitwall` or `npx pitwall`
5. Usage: three common commands
6. Screenshots (use placeholder directives for now: screenshots will
   be added after smoke test)
7. How it works (three pillars, one sentence each)
8. Privacy (100% local, no telemetry, no network calls)
9. Contributing (point at `CLAUDE.md` and the specs)
10. License (MIT — create `LICENSE` file)

### Smoke test

Run Pitwall against a real Claude Code session (any session the user
has in `~/.claude/projects/`) and verify:

1. `pitwall` command starts the server, opens the browser, loads the
   picker.
2. Click a session. Timeline renders with the correct chronological
   order.
3. Click a file in Timeline. Diff renders with syntax highlighting.
4. Click a chunk in the diff. Radio panel updates with the prompt and
   (if present) the thinking block.
5. Toggle to Sectors view. Sections render in chronological first-appearance
   order. Expand/collapse works.
6. Drag the Lap Replay scrubber. Selected edit changes.
7. Ctrl-C. Server shuts down cleanly.

Document any issues found and fix them, or file a follow-up spec for
v1.1 scope.

## Acceptance criteria

- `pnpm build` at repo root produces a distributable CLI bundle.
- `pnpm -F @pitwall/cli pack` produces a `.tgz` with correct `bin`
  wiring.
- Installing the `.tgz` globally and running `pitwall --help` prints
  the help text.
- Running `pitwall` in a directory with a Claude Code session spins
  up the full experience end-to-end.
- The smoke test checklist above passes on the maintainer's machine.
- `README.md` is written and renders correctly on GitHub (use the
  `pitwall-logo-dark.svg` from `brand/svg/`).
- `LICENSE` exists (MIT).

## Files to create

- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/cli/tsup.config.ts`
- `packages/cli/src/bin.ts`
- `packages/cli/src/banner.ts`
- `packages/cli/src/args.ts`
- `packages/cli/src/open-browser.ts`
- `packages/cli/src/project-hash.ts`
- `packages/cli/src/static-serve.ts` (teaches server how to serve
  client bundle — may live in server package instead, your call)
- `packages/cli/test/args.test.ts`
- `packages/cli/test/project-hash.test.ts`
- `README.md` (root)
- `LICENSE` (root, MIT)
- `.github/workflows/ci.yml` (build + test on Node 20, 22)
- `CHANGELOG.md` (root, starting at 0.1.0)

## Notes

- `open`-package (or a small hand-written equivalent) for opening the
  browser.
- Project path hashing: import `projectHash` from `@pitwall/parser`
  (shipped in spec 02). Algorithm and rationale live in
  `docs/02-data-model.md` under the `Session.projectHash` note. Do
  not re-derive.
- Do not publish to npm automatically in CI. v1 publish is manual.

## Do not

- Do not add analytics, telemetry, or any network call. Pitwall is
  local-only, full stop.
- Do not add update checks. Users update via `npm update`.
- Do not auto-upgrade anything. Do not touch `~/.claude` beyond reading.
