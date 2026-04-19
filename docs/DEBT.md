# DEBT

## Purpose

Pitwall carries a handful of technical debt items that are currently
worked around inline in the code and flagged with comments. This file
is the single registry of those items so that (a) reviewers can see
the full list in one place, and (b) when a trigger condition arrives,
the proper fix is a matter of opening this doc, not hunting through
comments. Entries should be removed from this file when they are
resolved, not left as historical notes.

> Last reviewed: 2026-04-19

---

## 1. Test-server port race — RESOLVED (spec 15, 2026-04-19)

Server tests now call `startServer({ port: 0, logger: false })` so the
kernel assigns a free port atomically. The TOCTOU probe→close→listen
gap in `findFreePort` can no longer be hit by test code. File
parallelism is re-enabled (`vitest.config.ts` no longer sets
`fileParallelism: false`) and the `Connection: close` fetch wrapper in
`test/setup.ts` was deleted along with the setup file.

The walker in `src/port.ts` is still exported and still powers the CLI
default (start at 4317 and walk up) — the predictable-port UX is worth
more in production than the microscopic race risk, and nothing in
production forks the server. Only the "walks to the next free port
when start port is taken" test (`server.test.ts`) still exercises the
walker explicitly.

Entry kept in place (not renumbered) so downstream references and
code-comment pointers don't drift.

---

## 2. `/private/var` symlink edge in `relativizePath`

**Current behavior.** On macOS, paths under `/private/var/...` can
refer to the same file as paths under `/Users/...` (or similarly
`/tmp` → `/private/tmp`) via system symlink. The `relativizePath`
helper in the parser compares absolute paths against the project
root as strings; when the session's recorded path and the project
root sit on different sides of a symlink, the prefix match fails and
the path is kept as-is (absolute) instead of being relativized.

**Workaround location.**
- `packages/parser/src/session.ts` — code comment above
  `relativizePath` documenting the limitation.

**Proper fix.** Resolve symlinks on both sides via `fs.realpath`
before comparing.

**Trigger.** Only if users complain about duplicate-looking paths —
e.g. the same file appearing twice in a session's timeline under two
different absolute prefixes. The Radio panel still renders usefully
with absolute paths, so the cost of delaying is cosmetic.

---

## 3. `HTTPServer` / `XMLParser` acronym splitting in intent scoring

**Current behavior.** The intent scorer (`pickTriggeringSentence`)
extracts keyword tokens from mixed-case identifiers by splitting on
`[A-Z]` boundaries. For identifiers that begin with a run of
uppercase letters — `HTTPServer`, `XMLParser`, `URLBuilder` — the
split yields `[httpserver, server]` and `[xmlparser, parser]`, not
`[http, server]` / `[xml, parser]`. The full-identifier token keeps
some signal, but a prompt sentence that mentions `http` or `xml`
alone will not match.

**Workaround location.**
- `packages/parser/src/intent.ts` — code comment in
  `extractKeywords` describing the limitation. The Radio panel
  degrades gracefully because the full-prompt view always renders,
  even when no sentence crosses the scoring threshold.

**Proper fix.** Split on both `[a-z][A-Z]` and `[A-Z][A-Z][a-z]`
transitions so a run-of-uppercase-followed-by-lowercase boundary
(`HTTP|Server`) is detected. Add unit tests covering the
acronym-prefix case.

**Trigger.** If users report that the Radio highlight is missing in
sessions whose prompts mention a protocol or format acronym ("the
XML parser", "the HTTP server") when the edited file clearly matches.

---

## 4. React Router v6 → v7 future-flag warnings

**Current behavior.** React Router v6 prints informational console
warnings about future v7 behavior changes (v7_startTransition,
v7_relativeSplatPath) during client tests and in the dev console.
Warnings are not errors and do not affect test results or rendering —
they are advisory notices from the library.

**Workaround location.** None currently — warnings are visible in
client test output and browser dev console.

**Proper fix.** Pass `future={{ v7_startTransition: true,
v7_relativeSplatPath: true }}` to both `<BrowserRouter>` in
`packages/client/src/main.tsx` and `<MemoryRouter>` in client test
files. This opts into v7 behavior proactively and silences the
warnings. Alternatively, when the broader ecosystem moves to
react-router v7, upgrade the dep.

**Trigger.** Whenever the codebase next does a React Router upgrade
pass, or if the warning volume grows enough to obscure real test/dev
signal in spec 09+.

---

## 5. Timestamp locale-sensitivity

**Current behavior.** `formatRelativeTime` uses `toLocaleDateString()`
for timestamps older than a year, which respects the system locale.
On Arabic-locale systems (common in MENA markets), dates render with
Arabic-Indic digits (٠–٩) rather than Latin digits, creating visual
inconsistency with surrounding code content which is always in Latin
digits. Current behavior is technically correct; the question is
whether "respect user locale" or "match code content" is the right
product stance.

**Workaround location.**
- `packages/client/test/relative-time.test.ts` — uses `/\p{Nd}/u`
  (Unicode decimal number property) so tests pass regardless of
  system locale. No production-code workaround.

**Proper fix.** Either (a) force `en-US` locale on the
`toLocaleDateString()` call so dates always render in Latin digits
matching surrounding code, or (b) document the locale-respecting
behavior as intentional and add a user-facing setting if it becomes
a friction point. Decision pending product feedback.

**Trigger.** User feedback about timestamp readability in non-English
locales, or any spec that revisits datetime rendering.

---

## 6. Shiki-highlighted render path has no test coverage

**Current behavior.** jsdom cannot initialize Shiki's Oniguruma WASM,
so all `DiffView` component tests exercise the plain-text fallback
branch. The highlighted render path (the `tokensByPostLine` map
feeding `DiffLine` tokens) is covered only by code-read, not by
assertion. Tests pass because
`packages/client/src/lib/shiki.ts` returns `null` on WASM init
failure and `DiffLine` renders plain text.

**Workaround location.** None currently — tests pass via the
graceful fallback.

**Proper fix.** Add either (a) a Playwright-style browser e2e test
that exercises real Shiki highlighting, or (b) a Shiki mock in test
setup that returns synthetic `ThemedToken[][]` matching the expected
interface, so `DiffLine`'s token-to-span rendering gets assertion
coverage.

**Trigger.** E2E test infrastructure lands (post-v1), or a bug
surfaces in the browser that the plain-text-only tests did not
catch.

---

## 7. Custom Pitwall Shiki theme deferred

**Current behavior.** `DiffView` uses `github-dark-default` directly.
The original plan was a custom `pitwall-dark` theme overriding
background, foreground, and comment color from Pitwall tokens while
inheriting syntax colors from `github-dark-default`. Dropped in spec
11 because Shiki's `createHighlighter` types the theme name as
`BundledTheme | ThemeRegistrationAny` and a custom string literal
narrows wrongly in TypeScript.

**Workaround location.**
- `packages/client/src/lib/shiki.ts` — uses the `github-dark-default`
  string name directly. Diff row backgrounds come from Tailwind CSS
  classes (`bg-pw-diff-add-bg` / `bg-pw-diff-del-bg`), not the theme.

**Proper fix.** Pass the theme object by reference in
`codeToTokensBase` rather than by string name so TypeScript accepts
a `ThemeRegistration` object directly. Alternatively, add a single
`as ThemeRegistration` cast with a `// reason:` comment per
CLAUDE.md §5. The custom theme would override `fg` to
`--pw-fg-primary` and comments to `--pw-fg-muted` while inheriting
syntax colors unchanged.

**Trigger.** Browser visual check reveals specific token-color deltas
that matter, or a future spec wants tighter Pitwall-token
integration in syntax highlighting.

---

## 8. 500-line warm-render perf budget not measured

**Current behavior.** Spec 11 AC specifies "a 500-line diff renders
within 300ms on warm load." No automated test enforces this budget.
Shiki's tokenization cost scales with line count and language
complexity, and we have no empirical data on whether real 500-line
files actually hit the budget.

**Workaround location.** None. `DiffView.test.tsx` uses small
synthetic diffs (3–10 lines); none exercise the 500-line path.

**Proper fix.** Add a perf test — either a vitest benchmark against
a synthetic 500-line diff measuring the full render path
(`buildDiffSegments` + Shiki tokenization + React render), or a
browser-timing assertion during a future spec that adds client-side
perf infrastructure (mirrors the server-side perf test pattern from
spec 07).

**Trigger.** User reports slow diff rendering, or a future spec
(likely 14 or 15) adds client-side perf testing infrastructure.

---

## 9. Pre-first-edit Timeline highlight/diff mismatch

**Current behavior.** When the Lap Replay scrubber is seeked to a
time earlier than the first recorded edit's `tMs`, Pitwall auto-
selection picks "no edit" and writes `?tMs=N` without an `?edit`
param. `useSelectedEdit` (spec 10) was written before the scrubber
existed and falls back to edit 01 when `?edit` is absent, so the
Timeline/SectorsView visually highlights edit 01 while the Diff
middle panel and the Radio right panel correctly render the
pre-first-edit empty state. The two rails therefore disagree during
the thin `[0, firstEdit.tMs)` window.

**Workaround location.**
- `packages/client/src/routes/Session.tsx` — `isPreFirstEdit` helper,
  plus `ScrubberContainer`, `MiddlePanel`, and `RightPanelReady` all
  carry comments pointing at this entry.

**Proper fix.** Teach `useSelectedEdit` about `?tMs`: when `?tMs` is
present AND `?tMs < firstEdit.tMs`, skip the edit-01 fallback and
return `selectedId === null`. Timeline/SectorsView then render with
nothing highlighted during the pre-first-edit window, matching the
diff and radio panels. No spec-14 behavior changes; the URL shape
stays identical.

**Trigger.** v1.1 polish pass, or the first user report that the
left rail "looks wrong" when the scrubber sits at the very start of
a session.
