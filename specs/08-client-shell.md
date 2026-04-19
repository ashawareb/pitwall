# Spec 08 · client-shell

## Purpose

Scaffold `@pitwall/client` with Vite, React 18, Tailwind, and the design
tokens from `docs/04-ui-system.md`. Establish routing and the top-level
layout shell. No real content yet beyond placeholders.

## Dependencies

Spec 05 must be complete (so the dev proxy target exists). The server
does not need to be fully built.

## Scope

- Vite + React 18 project with strict TS.
- Tailwind 3 configured with the full token table from
  `docs/04-ui-system.md`.
- CSS custom properties on `:root` for the tokens, referenced by
  Tailwind theme extensions.
- Routing with `react-router-dom`:
  - `/` → session picker placeholder
  - `/s/:projectHash/:sessionId` → session view placeholder (three-panel
    shell rendered with visible labels but no real content)
- A minimal top-level layout: app background, centered content on the
  picker page, full-bleed panels on the session view.
- An API client module in `src/api/` with typed functions for every
  endpoint from `docs/03-api-contract.md`. They should fail loudly in
  dev if the server isn't running.
- Vite dev server proxies `/api/*` to `http://localhost:4317`.

## Acceptance criteria

- `pnpm -F @pitwall/client dev` opens Vite on its default port with HMR.
- Visiting `/` shows a centered session picker placeholder.
- Visiting `/s/abc/xyz` shows the three-panel shell with labels
  `TIMELINE`, diff placeholder, `RADIO` — all using the design tokens.
- The visual result matches the tokens table in
  `docs/04-ui-system.md`: correct panel bg, panel corners, typography,
  metadata label style, colors.
- Dark mode is default and unconditional. Prefer-color-scheme is
  ignored.
- The API client module exports typed functions for every endpoint
  and uses Zod-inferred types (shared with parser if practical; else
  re-declared and tested for parity).
- `pnpm -F @pitwall/client build`, `typecheck`, `lint`, `test` pass.
- At least 2 component smoke tests (picker shell, session view shell).

## Files to create

- `packages/client/package.json`
- `packages/client/index.html`
- `packages/client/vite.config.ts`
- `packages/client/tsconfig.json`
- `packages/client/tailwind.config.ts`
- `packages/client/postcss.config.cjs`
- `packages/client/src/main.tsx`
- `packages/client/src/App.tsx`
- `packages/client/src/styles/tokens.css`
- `packages/client/src/styles/index.css`
- `packages/client/src/routes/Picker.tsx`
- `packages/client/src/routes/Session.tsx`
- `packages/client/src/layout/TopBar.tsx`
- `packages/client/src/layout/ThreePanel.tsx`
- `packages/client/src/api/client.ts`
- `packages/client/src/api/endpoints.ts`
- `packages/client/src/api/types.ts`
- `packages/client/test/Picker.test.tsx`
- `packages/client/test/Session.test.tsx`

## Notes

- Use Vitest + React Testing Library for tests.
- Do not use shadcn/ui, Radix, or any component library. Pitwall's UI
  is too specific; a library will fight us.
- Lucide-react is allowed for tiny icons (e.g., chevrons). Sparingly.

## Do not

- Do not render real diffs yet. That is spec 11.
- Do not hook up real session data yet. That is spec 09.
- Do not implement the Timeline or Radio logic. Specs 10 and 12.
- Do not style components beyond what the tokens prescribe.
