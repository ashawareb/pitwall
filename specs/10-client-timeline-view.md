# Spec 10 · client-timeline-view

## Purpose

Implement the **default** left rail: a chronological numbered list of
files the AI edited, in the exact order they were edited.

This is the primary navigation surface of the session view. The
Sectors view (spec 13) is a secondary toggle.

## Dependencies

Specs 07 and 08 must be complete.

## Scope

- Fetch the session detail on mount of `/s/:hash/:id`.
- Left rail renders a list of `FileEdit` rows in `orderIndex` order.
- Each row shows:
  - The order number (01, 02, 03…) in faint monospace, left-aligned
    in a fixed-width column.
  - The filename (basename only — not full path).
  - Sector tag in the sector's color.
  - Operation + additions/deletions (e.g., `Edit +14 −3`, `Write +42`).
- Selected row has the `--pw-bg-selected` background, `--pw-accent`
  2px left border, and the order number + filename in `--pw-accent`.
- Row click selects the row and updates URL with `?edit=<editId>`
  so the state is linkable.
- Above the list, a small toggle: `TIMELINE` (active, `--pw-accent`) /
  `SECTORS` (inactive, `--pw-fg-faint`). Clicking Sectors navigates to
  the Sectors view defined in spec 13.
- Keyboard: `j` / `k` move selection down/up with wrap. `Enter` no-op
  (already selected = already shown).

## Acceptance criteria

- Loading `/s/:hash/:id` selects edit 01 by default and displays it.
- Query string sync: `?edit=<editId>` is the single source of truth
  for which row is selected. Back/forward navigation works.
- Filenames that collide (same basename, different directory) render
  with the first distinct path segment prefixed, like
  `models/user_tag.rb` vs `serializers/user_tag.rb`.
- Rows render at 44px tall, consistent.
- Scroll position is preserved when switching between rows by click
  but reset when entering a new session.
- At least 3 component tests covering: render, click, keyboard.

## Files to create / modify

- `packages/client/src/routes/Session.tsx` (expand — replace left
  rail placeholder)
- `packages/client/src/components/Timeline.tsx` (new)
- `packages/client/src/components/TimelineRow.tsx` (new)
- `packages/client/src/components/RailToggle.tsx` (new)
- `packages/client/src/hooks/useSelectedEdit.ts` (new — URL ⇄ state)
- `packages/client/test/Timeline.test.tsx` (new)

## Notes

- The "+ N more" truncation shown in mockups only applies when the
  rail viewport would otherwise overflow. Use virtualization (a
  simple windowed list — do not import a large virtualization
  library; 100 lines hand-rolled is enough) for sessions with more
  than 50 edits.

## Do not

- Do not render the diff here. That is spec 11.
- Do not render the Radio panel here. That is spec 12.
- Do not implement the Sectors view here. That is spec 13.
- Do not sort by anything other than `orderIndex`. Chronological is
  the product.
