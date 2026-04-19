# 04 · UI system

The Pitwall visual language. Every UI spec conforms to this document.
Deviations require a spec amendment, not an ad-hoc override.

## Identity

- **Mood:** terminal-native, rugged, high-legibility, no decoration.
  Think lazygit, delta, k9s. Casio watch LCD. F1 timing board.
- **Not this:** glassmorphism, gradients, neon glow, drop shadows,
  hero animations, brand illustrations.
- **Density:** dense by default. White space is for separating
  functional regions, not for looking airy.
- **Color temperature:** cool — near-black background, off-white text,
  one functional green accent. Warm colors (red, amber) are reserved
  for semantic states (errors, warnings).

## Color tokens

### Backgrounds

| Token                 | Value      | Use                                     |
| --------------------- | ---------- | --------------------------------------- |
| `--pw-bg-app`         | `#0a0a0a`  | Outermost app background                |
| `--pw-bg-panel`       | `#111111`  | Every panel (left rail, middle, right)  |
| `--pw-bg-panel-hover` | `#161616`  | Panel items on hover                    |
| `--pw-bg-selected`    | `rgba(74,222,128,0.08)` | Selected row tint     |

### Text

| Token             | Value                       | Use                      |
| ----------------- | --------------------------- | ------------------------ |
| `--pw-fg-primary` | `#e5e5e5`                   | Default text             |
| `--pw-fg-muted`   | `rgba(255,255,255,0.55)`    | Secondary text           |
| `--pw-fg-faint`   | `rgba(255,255,255,0.35)`    | Labels, metadata         |
| `--pw-fg-ghost`   | `rgba(255,255,255,0.2)`     | Line numbers, separators |

### Accents

| Token               | Value      | Use                                |
| ------------------- | ---------- | ---------------------------------- |
| `--pw-accent`       | `#4ade80`  | Pitwall green — selected, active   |
| `--pw-accent-soft` | `rgba(74,222,128,0.15)` | Highlighted sentence tint |

### Semantic

| Token            | Value      | Use                          |
| ---------------- | ---------- | ---------------------------- |
| `--pw-diff-add`  | `#86efac`  | Added line text color        |
| `--pw-diff-add-bg` | `rgba(74,222,128,0.1)` | Added line bg       |
| `--pw-diff-del`  | `#fca5a5`  | Removed line text color      |
| `--pw-diff-del-bg` | `rgba(248,113,113,0.08)` | Removed line bg  |
| `--pw-warn`      | `#fbbf24`  | Warning states               |
| `--pw-error`     | `#f87171`  | Error states                 |

### Sector colors

Muted, distinct, non-semantic. Used for the sector tags in the
Timeline rows and as the accent color for Sectors view sections.

| Sector       | Color       |
| ------------ | ----------- |
| migrations   | `#60a5fa`   |
| models       | `#4ade80`   |
| controllers  | `#fbbf24`   |
| views        | `#f472b6`   |
| tests        | `#a78bfa`   |
| config       | `#94a3b8`   |
| tasks        | `#9ca3af`   |
| other        | `#6b7280`   |

## Typography

- **Code:** `ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo,
  Consolas, monospace`
- **UI:** `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Inter,
  sans-serif`
- **Sizes:** 10px for labels, 11px for UI copy, 10.5px for code (so
  more lines fit on screen), 9px for all-caps metadata labels with
  `letter-spacing: 0.15em`.

No font-size below 9px. No font larger than 13px in the main UI —
this is a dashboard, not a landing page.

Font weights: 400 (regular) and 500 (medium) only. No 600, 700, or
bolder in the main UI. The wordmark is the sole exception — it uses
700.

## Layout

### Three-panel main view

```
+-----------------------------------------------------+
|                  TOP BAR                            |
| [● session title · meta]     [LAP REPLAY ▬▬●▬▬▬▬]   |
+----------+----------------------------+-------------+
|          |                            |             |
| TIMELINE |         DIFF VIEW          |    RADIO    |
| or       |                            |   PROMPT +  |
| SECTORS  |                            |   THINKING  |
|          |                            |             |
| 168 wide |       ~1fr                 |  180 wide   |
+----------+----------------------------+-------------+
```

- Gaps between panels: 8px.
- Panel padding: 10px.
- Panel corner radius: 6px.
- Top bar is its own panel with the same styling.

### Session picker

- Left rail only, full width (but max 480px centered).
- Each session row: 2 lines tall, 60px.
- Hover shows `--pw-bg-panel-hover`.
- No "recent activity" section, no sidebar ads, no onboarding — just
  the list.

## Visual conventions

- **Corners:** 6px on panels, 3px on interactive elements, 2px on
  small indicator pills. Never 0px (looks raw), never >8px (looks
  consumer-y).
- **Borders:** `0.5px solid rgba(255,255,255,0.08)` where a border is
  needed. Panels separate by background contrast, not borders, by
  default.
- **Dots:** the live-status dot is a 6px circle in `--pw-accent`.
  Always to the left of the labelled thing.
- **Metadata labels:** uppercase, 9px, `letter-spacing: 0.15em`, color
  `--pw-fg-faint`. Examples: `TIMELINE`, `SECTORS`, `RADIO`, `PROMPT`,
  `THINKING`, `TOOL`, `TURN`, `T+`.
- **Scrollbars:** use the OS native scrollbar. Do not style them.

## Motion

- Hovers: no transitions. Instant feedback.
- Panel content swaps: instant. No fade.
- Timeline scrubber drag: the diff rebuild is instant on each frame.
  If that's too slow, cache, don't throttle.
- The only acceptable motion is the live-dot pulse (2s gentle opacity
  loop) on the session title, and the timeline scrubber thumb follow.
- Never animate layout. Never animate color. Never animate anything on
  load.

## Diff rendering

- Unified by default (not split).
- Line numbers on the left, `--pw-fg-ghost`.
- Added lines: `--pw-diff-add-bg` background, 2px `--pw-accent` left
  border.
- Removed lines: `--pw-diff-del-bg` background, 2px `--pw-error` left
  border.
- Currently-selected chunk: a brighter inset shadow (`inset 0 0 0 1px
  rgba(74,222,128,0.25)`) overlaid on the added-line styling.
- Syntax highlighting: Shiki with a tuned theme matching these tokens.
  Spec 11 defines the exact theme.

## Radio panel structure

From top to bottom:

1. `RADIO` label with the live dot.
2. `↓ PROMPT` section. Prompt text in UI sans, regular. Triggering
   sentence inlined with `--pw-accent-soft` background + 1px inset
   shadow in `--pw-accent`.
3. `↑ THINKING` section. Thinking text in UI sans, italic, muted
   (`--pw-fg-muted`). If no thinking block exists, render
   `(no reasoning captured)` in `--pw-fg-faint`.
4. A `0.5px` separator.
5. Three metadata rows: `TOOL`, `TURN`, `T+`.

The arrow indicators (↓, ↑) use `--pw-accent` color.

## Design system implementation

- Tokens live in `packages/client/src/styles/tokens.css` as CSS
  custom properties on `:root`.
- Tailwind is extended to expose these tokens via `theme.extend` in
  `tailwind.config.ts`.
- Components never reference raw hex. Always a token.
- If a component needs a value not in the token list, the first step
  is to propose a spec amendment to add the token.
