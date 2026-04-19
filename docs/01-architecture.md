# 01 · Architecture

## Monorepo layout

Pitwall is a pnpm workspace with four packages:

```
pitwall/
├── packages/
│   ├── parser/        # @pitwall/parser — pure TS library
│   ├── server/        # @pitwall/server — Fastify local server
│   ├── client/        # @pitwall/client — React+Vite app
│   └── cli/           # pitwall — the bin that users run
├── docs/
├── specs/
├── prompts/
├── brand/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .eslintrc.cjs
├── .prettierrc
├── CLAUDE.md
└── README.md
```

## Package responsibilities

### @pitwall/parser

The core of the product. A pure TypeScript library with zero runtime
dependencies on the server or client. Its job:

- Stream-read JSONL files from `~/.claude/projects/<hash>/*.jsonl`.
- Validate every line with Zod against the Claude Code session schema.
- Reconstruct `Session`, `Turn`, `ToolCall`, and `FileEdit` objects.
- Reconstruct pre/post `FileState` for each edit so downstream
  consumers can diff against the real pre-session state — not against
  git HEAD.
- Extract the triggering user prompt sentence and the preceding
  thinking block for each file edit (the Radio data).

The parser is published as `@pitwall/parser`. Downstream consumers
(server, any future TUI, VS Code extension) all import from it. Do not
duplicate parsing logic anywhere else.

### @pitwall/server

A Fastify HTTP server that runs locally. Its job:

- Boot on an available port starting at 4317 and walking up.
- Serve the client's static bundle in production mode.
- Expose the REST API defined in `docs/03-api-contract.md`.
- Read JSONL files on request, cache parsed sessions in memory. No
  database. No persistence layer.
- Handle CORS for `http://localhost:*`.
- Shut down cleanly on SIGINT/SIGTERM.

The server is not published on its own. It is bundled into the CLI.

### @pitwall/client

A Vite + React + Tailwind app. Its job:

- Render the Pitwall UI: session picker, Timeline/Sectors left rail,
  diff view, Radio panel, Lap Replay scrubber.
- Talk to `@pitwall/server` over the REST API.
- Apply the design system from `docs/04-ui-system.md`.
- Use Shiki for syntax highlighting.
- Remain framework-pure: no direct Node APIs. All state comes through
  the API. This preserves the option to reuse the client inside a
  Tauri shell or VS Code webview later without rewrites.

The client is not published on its own. Its built bundle is copied
into the CLI.

### pitwall (CLI)

The user-facing entry point. Distributed on npm as `pitwall` (or a
scoped name if unavailable — see spec 15). Its job:

- Accept flags: no args (current directory), `--all`, `--session <id>`,
  `--port <n>`, `--no-open`.
- Hash the current working directory the same way Claude Code does to
  resolve the project folder under `~/.claude/projects/`.
- Start `@pitwall/server` on an available port.
- Open the default browser to the right URL (unless `--no-open`).
- Print a clear banner with the URL and keyboard shortcut for quit.
- Trap Ctrl-C and shut the server down cleanly.

## Data flow

```
~/.claude/projects/<hash>/*.jsonl
            │
            │  (file system read)
            ▼
    @pitwall/parser
            │
            │  (typed objects)
            ▼
    @pitwall/server  ←───  REST  ───→  @pitwall/client
            │                                 │
            └── serves bundled ────────────────┘
```

## Build

- `pnpm build` at the root runs every package's build in dependency
  order.
- `parser` builds with `tsup` to ESM + CJS + types.
- `server` builds with `tsup` to ESM.
- `client` builds with `vite build` to a static bundle.
- `cli` builds with `tsup`, then copies the client's `dist/` into its
  own `dist/static/`.

## Development

- `pnpm dev` runs parser in watch mode, server in watch mode, and
  client in Vite dev mode with HMR.
- The client's Vite dev server proxies `/api/*` to the server's port.
- Hot reloads work across the parser → server chain.

## Why this shape

- **Parser isolation** means a future TUI or VS Code extension can
  reuse it verbatim. Pitwall v2 is not blocked by v1 decisions.
- **Client isolation from Node APIs** means the React app can be
  embedded in Tauri or a webview later without refactoring.
- **No database** means zero setup, zero migration, zero "my local
  Pitwall broke" debugging. Everything is derived from JSONL on demand.
- **Monorepo over multi-repo** because these packages ship together
  and change together. A separate repo per package would be
  administrative overhead with no benefit.
