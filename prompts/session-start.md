# Session-start prompts for Pitwall

This file contains the exact prompts to paste into Claude Code at the
start of every session. Do not improvise — the discipline these prompts
enforce is the reason Pitwall will ship without drift.

---

## § 1 — First-ever session (spec 01)

Paste this the very first time you open Claude Code in a fresh Pitwall
repo.

```
You are building Pitwall — a local web application for reviewing
Claude Code sessions. You are starting from spec 01.

MODEL CHECK:

Before you do anything else, confirm you are running on Opus 4.7. If
you are not, stop and tell me immediately. Do not proceed on Sonnet,
Haiku, or any earlier Opus version.

READ FIRST (in order):

1. CLAUDE.md
2. docs/00-overview.md
3. docs/01-architecture.md
4. docs/02-data-model.md
5. docs/03-api-contract.md
6. docs/04-ui-system.md
7. specs/01-parser-jsonl-reader.md

After reading, summarize in 5 lines:
- What Pitwall is
- The three pillars
- The monorepo shape
- What spec 01 asks you to build
- The A→F cycle (from CLAUDE.md)

Then stop. Wait for me to say `go`.

WHEN I SAY GO:

Execute the A→F cycle on spec 01:
- A: Analyze — you just did this. Restate your plan in one paragraph.
- B: Blueprint — list every file you will create, every test, anything
     uncertain. Wait for my approval.
- C: Code — execute the approved plan.
- D: Diff — present a full diff summary.
- E: Evaluate — run `pnpm build`, `pnpm typecheck`, `pnpm lint`,
     `pnpm test`. All must pass. Return to C if they don't.
- F: Finalize — commit with the prescribed message, state "Spec 01
     complete. Open a fresh session for spec 02." Stop.

Do not proceed past any of B, D, E without my explicit approval.

After F's commit, run § 5's end-of-session check and surface the
answers before the "Spec 01 complete" announcement. Do not wait for
me to prompt.
```

---

## § 2 — Every subsequent spec session

Paste this at the start of every session for specs 02 through 15.
Replace `NN` with the spec number.

```
You are continuing to build Pitwall. You are starting from spec NN.

MODEL CHECK:

Confirm you are running on Opus 4.7. If not, stop and tell me.

READ FIRST (in order):

1. CLAUDE.md
2. docs/00-overview.md
3. docs/01-architecture.md
4. docs/02-data-model.md
5. docs/03-api-contract.md
6. docs/04-ui-system.md
7. specs/NN-*.md (the current spec)
8. Every prior completed spec file (specs/01 through NN-1)
9. The code for every package the current spec touches

After reading, summarize in 5 lines:
- What spec NN asks you to build
- Which prior specs it depends on
- The package(s) it touches
- Anything unclear that needs clarification before you plan
- Your confidence level

Then stop. Wait for me to say `go`.

WHEN I SAY GO:

Execute the A→F cycle on spec NN. Same rules as § 1.

After F's commit, run § 5's end-of-session check and surface the
answers before the "Spec N complete" announcement. Do not wait for
me to prompt.

Remember: the spec is the source of truth. If you find yourself
wanting to build anything outside its scope, stop and propose a spec
amendment (§ 4).
```

---

## § 3 — Regression protocol

Use this if code breaks after a spec was marked "done" — e.g., a test
started failing in an earlier package, or the build stopped working.

```
A regression has been detected. Do not implement new features. We are
fixing the regression first.

MODEL CHECK:

Confirm Opus 4.7.

READ FIRST:

1. CLAUDE.md
2. docs/ (all)
3. The spec that most recently closed (specs/NN-*.md)
4. The failing output I'm about to paste

THE FAILURE:

{{ paste the failing test output, build error, or runtime error }}

PROCESS:

1. Identify the specific commit / spec where the regression was
   introduced. Use `git log` and `git bisect` if needed.
2. Tell me which spec's implementation is at fault.
3. Propose the minimal fix. Wait for my approval.
4. Apply the fix. Run all checks. If they pass, commit with:
     fix(spec-NN): <one-line summary>
5. Stop.

Do not "improve" anything along the way. Fix the regression. Nothing
else.

If the regression reveals that a spec is wrong, stop and propose a
spec amendment first (§ 4); we update the doc, then fix the code. The
code must always match the spec, not the other way around.

Now begin.
```

---

## § 4 — Spec revision prompt

Use this when you realize a spec needs to change — before or during
implementation.

```
You are revising a Pitwall spec. Not implementing — revising.

MODEL CHECK:

Confirm Opus 4.7.

READ FIRST:

1. CLAUDE.md
2. docs/00-overview.md through docs/04-ui-system.md
3. The spec file in question
4. Every spec or doc that references or depends on this one

CHANGE I WANT:

{{ describe the change }}

PROCESS:

1. Summarize what the spec currently says in the affected area.
2. Describe how the change alters it.
3. List every downstream spec or doc that would need a matching update.
4. Call out consequences (existing code that would break, API shape
   changes, reordering of later specs, etc.).
5. Propose the exact diff to the spec file(s) — before/after.

Do not edit any doc yet. Wait for my approval.

ONCE APPROVED:

- Edit the spec file(s).
- If the data model or API contract changes, update docs/02 or docs/03.
- Update CHANGELOG.md if user-facing behavior changes.
- Commit: `docs(spec): NN-<spec-name> — <change-summary>`.

Then stop. Code implementation is a separate session.
```

---

## § 5 — End-of-session check

Paste this at the very end of every session before closing it.

```
End-of-session check:

1. Which model did you run this session on? Was it Opus 4.7 the whole
   time, or did it change?
2. git status — clean?
3. pnpm build — success?
4. pnpm typecheck — clean?
5. pnpm lint — clean?
6. pnpm test — all passing?
7. Every acceptance criterion for spec NN verified?
8. Anything you want added to a spec or CLAUDE.md before we close?

One short answer per line. If any answer is "no" or "partial", tell me
what's left before we stop.
```

---

## How this works in practice

**Your first Claude Code session:**
1. Paste § 1.
2. Claude confirms Opus 4.7, reads the docs, summarizes, stops.
3. You say `go`.
4. Claude executes spec 01 via the A→F cycle. You approve the plan,
   it builds, you verify, it commits.
5. Claude says "Spec 01 complete. Open a fresh session for spec 02."
6. You paste § 5, verify, then close the session.

**Every subsequent session:**
1. Open a fresh Claude Code session.
2. Paste § 2 with the next spec number.
3. Claude confirms model, reads, summarizes, stops.
4. You say `go`. A→F cycle runs.
5. End with § 5.
6. Repeat through spec 15.

**When something goes wrong:**
- Code breaks after a "done" spec → § 3.
- A spec needs to change → § 4.
- The session feels off, Claude is improvising, quality degrading —
  say "drift — fresh session" and start over. Do not try to recover
  in-session; open a new one.

**Your actual job in this workflow:**
- Confirm the model at § 1 / § 2 time.
- Read the plan each session. Approve or correct.
- Do the human-only verification steps when Claude asks.
- Say `go`, `drift — fresh session`, or `pause — let's revise spec NN`.
- Nothing else.

---

## Why this is structured this way

Quality drift has specific causes:

1. Context bloat (sessions sprawling across specs).
2. Lack of an anchoring plan.
3. Improvisation across sessions.
4. No verification discipline.
5. Model downgrade mid-session.

This template attacks all five:

1. One spec = one session. Fresh context at every boundary.
2. The A→F cycle enforces plan-before-code every single time.
3. Specs are the source of truth, not session memory.
4. Built-in end-of-session check + Opus confirmation at start.
5. Model check is the first thing every prompt asks for.

You do not have to remember any of this. Claude does, because the
prompts tell it to. Your role is review.
