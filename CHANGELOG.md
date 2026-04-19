# Changelog

All notable changes to the `pitwall` CLI are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-04-19

Initial release.

### Added

- `pitwall` CLI that reads Claude Code session logs from
  `~/.claude/projects/` and serves a local review UI at
  `http://127.0.0.1:<port>`.
- Flags: `--all`, `--session <uuid>`, `--port <n>`, `--no-open`,
  `--help`, `--version`.
- Auto-detects the current working directory and deep-links to that
  project's session picker.
- Bundled client (Timeline, Sectors, Radio, Lap Replay) served from the
  CLI — no separate install.
- Graceful shutdown on `SIGINT` / `SIGTERM`.
- 100% local: no network calls, no telemetry.
