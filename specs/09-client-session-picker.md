# Spec 09 · client-session-picker

## Purpose

Implement the landing page: a list of sessions for a project, with
metadata and a sector-summary bar per row. Clicking a row navigates
to `/s/:hash/:id`.

## Dependencies

Specs 06 and 08 must be complete.

## Scope

- On mount, resolve the active project:
  - If the URL is `/`, call `GET /api/projects` and if exactly one
    project is found, auto-select it. If many, show the list of
    projects first, then the user picks one, then show its sessions.
  - If the URL is `/p/:hash`, fetch sessions for that project directly.
- Session row content (per `docs/04-ui-system.md`):
  - First prompt (truncated to ~120 chars)
  - Relative timestamp (`3h ago`, `2d ago`)
  - Metadata pills: files count, tool-call count, duration
  - Sector summary bar: a horizontal bar split by color proportional
    to `sectorSummary`
- Clicking a row navigates to the session view.
- A simple filter field at the top searches within the first prompt
  text, case-insensitive. No backend involvement — filter client-side.
- Empty state: "No Claude Code sessions found in this project." with
  a hint: "Run `claude` here and come back."

## Acceptance criteria

- Navigating to `/` on a machine with one project shows that project's
  sessions immediately.
- Navigating to `/` on a machine with multiple projects shows the
  project list first.
- Sessions are ordered most recent first.
- The sector summary bar renders with the colors from
  `docs/04-ui-system.md`.
- Filter field narrows the list live. Empty query shows everything.
- Click → correct navigation to session view.
- The picker makes only the one list request necessary. No detail
  fetches.
- At least 3 component tests covering: render one project, empty
  state, filter behavior.

## Files to create / modify

- `packages/client/src/routes/Picker.tsx` (implement, replacing
  placeholder)
- `packages/client/src/routes/ProjectList.tsx` (new — multi-project
  case)
- `packages/client/src/components/SessionRow.tsx` (new)
- `packages/client/src/components/SectorBar.tsx` (new)
- `packages/client/src/components/FilterField.tsx` (new)
- `packages/client/src/utils/relative-time.ts` (new — no libraries)
- `packages/client/test/Picker.test.tsx` (expand)
- `packages/client/test/SessionRow.test.tsx` (new)

## Notes

- Relative time: "just now", "2m ago", "37m ago", "3h ago", "2d ago",
  "3w ago", "4mo ago". Above that, show the date.
- Session rows are 60px tall. Do not make them resize on hover.
- Do not render avatars, descriptions, or any content beyond what's
  in this spec.

## Do not

- Do not fetch session details on hover.
- Do not add pagination. Render all rows.
- Do not add sort controls. One order: most recent first.
