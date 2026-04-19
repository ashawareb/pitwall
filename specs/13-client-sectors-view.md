# Spec 13 · client-sectors-view

## Purpose

Implement the Sectors view: an alternate left-rail rendering that
groups file edits by architectural sector. This is a toggle, not a
replacement for Timeline.

## Dependencies

Spec 10 must be complete.

## Scope

- The `RailToggle` from spec 10 now actually toggles between Timeline
  and Sectors. State is stored in the URL as `?view=timeline` (default)
  or `?view=sectors`.
- Sectors view structure:
  - One collapsible section per sector that has at least one edit.
  - Sections ordered by the first appearance of a sector in the
    chronological `fileEdits` list (so the rail still reflects session
    flow, just grouped).
  - Section header: sector name (colored), edit count.
  - Section body: `FileEdit` rows, same row component as Timeline,
    but order number shown is the global `orderIndex + 1` (preserving
    chronological awareness even within a sector).
- Sections are collapsible. Collapsed state persists in the URL as
  `?collapsed=tests,views` (comma-separated).
- Selecting a row in Sectors view behaves identically to Timeline
  (updates `?edit=<editId>`, updates diff, updates Radio).
- The `SECTORS` label in the toggle becomes active (`--pw-accent`),
  `TIMELINE` becomes inactive.

## Acceptance criteria

- Toggle switches between views without remounting the diff or Radio
  panels. Current selection is preserved across the toggle.
- Sectors appear in the order their first edit occurred. `migrations`
  won't be forced before `models` unless migrations was edited first.
- Collapse state survives navigation and reload via URL.
- Visual style exactly matches `docs/04-ui-system.md` sector colors.
- Empty sectors (zero edits) are not rendered.
- At least 3 component tests covering: render with multiple sectors,
  toggle between views, collapse/expand persistence.

## Files to create / modify

- `packages/client/src/components/SectorsView.tsx` (new)
- `packages/client/src/components/SectorGroup.tsx` (new)
- `packages/client/src/components/RailToggle.tsx` (expand — now
  actually switches views)
- `packages/client/src/routes/Session.tsx` (wire the switch)
- `packages/client/src/hooks/useRailView.ts` (new — URL ⇄ state for
  view + collapsed set)
- `packages/client/test/SectorsView.test.tsx` (new)

## Notes

- Reuse `TimelineRow` from spec 10. Do not reimplement.
- The sector color comes from the tokens table in spec 08.
- Do not build a tree view. Sectors are flat groups, not nested.

## Do not

- Do not re-sort edits alphabetically within a sector. Chronological
  order within the group is the invariant.
- Do not add a "select all in sector" action. v1 has single-row
  selection only.
- Do not make Sectors the default view. Timeline is the default. Ever.
