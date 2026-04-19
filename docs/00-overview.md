# 00 · Overview

## What Pitwall is

Pitwall is a local web application for reviewing Claude Code sessions.
It reads session logs from `~/.claude/projects/<hash>/*.jsonl`,
reconstructs what the AI did, and renders it in an interface designed
specifically for human oversight of AI-generated code.

It is not a code editor. It is not a PR review tool. It is a
post-session analysis surface. Think of it as the pit wall where race
engineers sit after a lap — reading telemetry, reviewing decisions,
deciding what to do next.

## Who it's for

Developers who use Claude Code and want to review what the agent did
before trusting it. Specifically:

- Engineers reviewing their own agentic sessions before committing.
- Tech leads reviewing agentic work done by their team.
- Anyone who has had Claude Code dump 500 lines across 12 files and
  felt the friction of reviewing that in a standard `git diff`.

## The three pillars

### Radio — intent mapping

Every file edit the AI made is linked to two things:

1. The sentence in the user's prompt that triggered it.
2. The reasoning Claude produced before making the edit (from
   extended-thinking blocks when available).

Reviewers can read their own instruction, read the AI's interpretation
of that instruction, and then compare both to the resulting code. Three
data points per edit, every time.

### Timeline — chronological review

The default view is **not** a git diff. Files are listed in the exact
order Claude edited them: first edit at the top, last edit at the
bottom. Reviewers step through the session as the AI experienced it,
not as an alphabetical file tree.

Sectors (architectural grouping by directory — migrations, models,
controllers, tests) is a toggle, not the default.

### Lap Replay — session scrubbing

A timeline scrubber at the top of the view reconstructs the codebase
state at any point during the session. Drag backward to see what the
repo looked like before a later edit; drag forward to watch the session
play out. Useful when an earlier edit turns out to have been wrong and
a reviewer wants to see the point of divergence.

## Non-goals for v1

These are deliberately excluded. Do not add them without a spec
amendment.

- **No authentication, accounts, or sync.** Pitwall is local-only. All
  data lives on the user's machine.
- **No cloud backup of sessions.** JSONL files stay where Claude Code
  put them.
- **No multi-session comparison.** v1 reviews one session at a time.
- **No integrations with Jira, Slack, GitHub, etc.** v1 is a review
  tool, not a workflow tool.
- **No AI features inside Pitwall.** We do not use Claude to explain
  Claude Code's output. The tool is deliberately dumb and fast. This
  is not a limitation; it is the design.

## The pitch, in one sentence

The pitwall view of AI engineering — radio, sectors, lap replay, dark
mode, local-first, zero configuration.
