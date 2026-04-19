import type { Config } from 'tailwindcss';

// Tokens live in src/styles/tokens.css as CSS custom properties on :root.
// This config exposes them through Tailwind's `theme.extend` so components
// can write `bg-pw-bg-panel` / `text-pw-fg-muted` instead of arbitrary
// `bg-[var(--pw-bg-panel)]` literals. Adding a new token is a two-step:
// (1) add the variable in tokens.css, (2) expose it here.

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'pw-bg-app': 'var(--pw-bg-app)',
        'pw-bg-panel': 'var(--pw-bg-panel)',
        'pw-bg-panel-hover': 'var(--pw-bg-panel-hover)',
        'pw-bg-selected': 'var(--pw-bg-selected)',
        'pw-fg-primary': 'var(--pw-fg-primary)',
        'pw-fg-muted': 'var(--pw-fg-muted)',
        'pw-fg-faint': 'var(--pw-fg-faint)',
        'pw-fg-ghost': 'var(--pw-fg-ghost)',
        'pw-accent': 'var(--pw-accent)',
        'pw-accent-soft': 'var(--pw-accent-soft)',
        'pw-diff-add': 'var(--pw-diff-add)',
        'pw-diff-add-bg': 'var(--pw-diff-add-bg)',
        'pw-diff-del': 'var(--pw-diff-del)',
        'pw-diff-del-bg': 'var(--pw-diff-del-bg)',
        'pw-warn': 'var(--pw-warn)',
        'pw-error': 'var(--pw-error)',
        'pw-sector-migrations': 'var(--pw-sector-migrations)',
        'pw-sector-models': 'var(--pw-sector-models)',
        'pw-sector-controllers': 'var(--pw-sector-controllers)',
        'pw-sector-views': 'var(--pw-sector-views)',
        'pw-sector-tests': 'var(--pw-sector-tests)',
        'pw-sector-config': 'var(--pw-sector-config)',
        'pw-sector-tasks': 'var(--pw-sector-tasks)',
        'pw-sector-other': 'var(--pw-sector-other)',
      },
      fontFamily: {
        ui: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Inter',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          '"JetBrains Mono"',
          '"SF Mono"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        meta: '9px',
        label: '10px',
        code: '10.5px',
        ui: '11px',
      },
      letterSpacing: {
        meta: '0.15em',
      },
      borderRadius: {
        panel: '6px',
        interactive: '3px',
        pill: '2px',
      },
      keyframes: {
        'pw-live-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'pw-live-pulse': 'pw-live-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
