# Pitwall brand assets

Everything Pitwall needs for visual identity across app, web, and platform
surfaces. All files are production-ready.

## Files in this folder

```
brand/
├── svg/
│   ├── pitwall-logo.svg            # Full logo, uses currentColor (adapts)
│   ├── pitwall-mark.svg            # Mark only, uses currentColor (adapts)
│   ├── pitwall-logo-dark.svg       # Full logo, hardcoded light gray (for dark bg)
│   ├── pitwall-logo-light.svg      # Full logo, hardcoded near-black (for light bg)
│   └── pitwall-favicon.svg         # 32×32 optimized favicon
└── png/
    ├── pitwall-mark-light-{16,32,48,64,128,256,512,1024}.png
    ├── pitwall-mark-dark-{16,32,48,64,128,256,512,1024}.png
    ├── pitwall-logo-dark-{1x,2x,3x}.png      # 220×64, 440×128, 660×192
    ├── pitwall-logo-light-{1x,2x,3x}.png
    ├── pitwall-favicon-{16,32,48}.png
    ├── pitwall-apple-touch-180.png
    └── pitwall-android-{192,512}.png
```

## Which to use where

### Website

- **Header (adaptive):** `svg/pitwall-logo.svg` — set `color` in CSS to
  match your theme.
- **Header (fixed dark theme):** `svg/pitwall-logo-dark.svg` or
  `png/pitwall-logo-dark-{1x,2x}.png`.
- **Header (fixed light theme):** `svg/pitwall-logo-light.svg` or
  `png/pitwall-logo-light-{1x,2x}.png`.
- **Favicon:**
  ```html
  <link rel="icon" type="image/svg+xml" href="/brand/svg/pitwall-favicon.svg">
  <link rel="icon" type="image/png" sizes="16x16" href="/brand/png/pitwall-favicon-16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/brand/png/pitwall-favicon-32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/brand/png/pitwall-apple-touch-180.png">
  ```

### App store / package registry

- **npm avatar / GitHub org avatar:** `png/pitwall-mark-light-512.png`
  on dark profile, `png/pitwall-mark-dark-512.png` on light profile.
- **macOS app icon (if Tauri later):** `png/pitwall-mark-light-1024.png`
  (512 scaled 2x, with 10% margin around it — Tauri does this automatically).

### Social

- **Twitter/X avatar:** `png/pitwall-mark-light-512.png`
- **Twitter/X header:** composite the 1024 mark with left alignment on a
  `#0a0a0a` background at 1500×500.
- **OG image (for link previews):** composite `svg/pitwall-logo-dark.svg`
  centered on a `#0a0a0a` background at 1200×630.

### README

Use `svg/pitwall-logo-dark.svg` at the top of `README.md`. GitHub renders
SVG inline. Example:

```markdown
<p align="center">
  <img src="brand/svg/pitwall-logo-dark.svg" alt="Pitwall" width="320">
</p>
```

## Color tokens

- **Accent green (on dark backgrounds):** `#4ade80`
- **Accent green (on light backgrounds):** `#10b981`
- **Dark background:** `#0a0a0a`
- **Light text on dark:** `#e5e5e5`
- **Dark text on light:** `#0a0a0a`

## Usage rules

- **Do** use the logo at its natural proportions (220:64).
- **Do** preserve at least 16px of clear space on all sides.
- **Do** use the light variant on dark backgrounds and vice versa.
- **Don't** change the green accent to another color.
- **Don't** add drop shadows, gradients, or outlines.
- **Don't** stretch, rotate, or skew the logo.
- **Don't** use the mark at smaller than 16×16.
