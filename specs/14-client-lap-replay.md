# Spec 14 · client-lap-replay

## Purpose

Implement the top-bar scrubber. Dragging it rewinds/fast-forwards
the session, rebuilding file state at that point. This lets reviewers
see the codebase at any moment during the session.

## Dependencies

Specs 07, 11, 12, 13 must be complete.

## Scope

- Top bar structure per `docs/04-ui-system.md`:
  - Left: live dot + session title + meta (`Nm Ns · N files · N calls`)
  - Right: `LAP REPLAY` label + scrubber track + position thumb
- Scrubber:
  - Track is 120px wide, 4px tall, `rgba(255,255,255,0.08)` bg.
  - Fill (completion) is `--pw-accent` from 0 to current tMs.
  - Thumb is a 2px × 12px vertical bar in `--pw-accent`.
- Dragging the thumb updates `?tMs=<n>` in the URL.
- Clicking anywhere on the track snaps the thumb there.
- Left rail auto-selects the last edit whose `tMs <= currentTMs`.
  If no edit has occurred yet (tMs near 0), show an empty diff with
  a "Session just started — no edits yet." note.
- When the user drags, debounce the replay fetch at ~50ms.
- Replay fetches `GET /api/projects/:hash/sessions/:id/replay/:tMs`
  and caches the response per tMs.
- The diff view, when the replay state is active, shows the diff of
  the currently-selected edit against its own preContent as usual —
  the scrubber is informational, not a different rendering of the
  diff. Think of it as "this is where we are in the session, and the
  selected edit is this one."
- A small `LIVE` toggle button near the scrubber jumps back to end
  of session (`tMs = session.durationMs`) and removes `?tMs` from URL.

## Acceptance criteria

- Dragging scrubber selects different edits in the left rail based
  on `tMs`.
- Clicking the track snaps correctly and the selected edit updates.
- `?tMs` is the single source of truth for scrubber position.
- Initial load: no `?tMs` → position at end (live).
- Keyboard: `←` / `→` step to previous/next edit's tMs. `Home`
  jumps to 0. `End` jumps to live.
- No layout shift when selected edit changes due to scrubbing.
- At least 4 component tests covering: initial live state, drag,
  click-to-position, keyboard navigation.

## Files to create / modify

- `packages/client/src/components/Scrubber.tsx` (new)
- `packages/client/src/components/SessionTitle.tsx` (new — live dot +
  truncated prompt + meta row; extracted from Session.tsx)
- `packages/client/src/layout/TopBar.tsx` (expand — replace
  placeholder from spec 08)
- `packages/client/src/hooks/useReplayPosition.ts` (new)
- `packages/client/src/routes/Session.tsx` (wire TopBar + scrubber)
- `packages/client/test/Scrubber.test.tsx` (new)
- `packages/client/test/useReplayPosition.test.tsx` (new)

## Notes

- The scrubber does NOT modify the diff view's rendering of the
  currently-selected file. It modifies which edit is selected.
- Replay state (full file map at tMs) is only needed if we add a
  "project tree" view later. For v1, we fetch it but the only
  consumer is the auto-selection logic — which only needs the edit
  list plus tMs. If you don't need the replay endpoint for this, skip
  calling it for now.

## Do not

- Do not animate the scrubber thumb. It jumps to position.
- Do not play/pause the session automatically. No autoplay.
- Do not add a speed control. Drag speed = user speed.
- Do not persist the scrubber position in localStorage. URL only.
