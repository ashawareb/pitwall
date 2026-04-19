// Lazy Shiki highlighter for the DiffView. Only the languages we actually
// ship are registered — loading Shiki's full bundle would pull a megabyte of
// grammars. Theme is github-dark-default; its fg (#e6edf3) and comments
// (#8b949e) are within visual tolerance of --pw-fg-primary / --pw-fg-muted,
// and the theme's editor.background never renders because codeToTokensBase
// only emits per-token color/fontStyle — the panel bg comes from our CSS.
//
// init() is fire-and-forget: the first render kicks it off, later renders
// await the cached Promise. On failure the helper resolves to null and
// highlightLines returns null — DiffLine then renders plain text. The goal
// is "highlighting is progressive, not load-blocking."

import {
  createHighlighter,
  type Highlighter,
  type ThemedToken,
} from 'shiki';

const SUPPORTED_LANGS = [
  'ruby',
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'python',
  'yaml',
  'sql',
  'markdown',
  'json',
  'bash',
  'html',
  'css',
  'go',
  'rust',
] as const;

type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const SUPPORTED_SET: ReadonlySet<string> = new Set(SUPPORTED_LANGS);

const THEME_NAME = 'github-dark-default';

let highlighterPromise: Promise<Highlighter | null> | null = null;

function initHighlighter(): Promise<Highlighter | null> {
  return createHighlighter({
    themes: [THEME_NAME],
    langs: [...SUPPORTED_LANGS],
  }).catch(() => {
    // Init can fail in jsdom (no WASM) or a cold CDN situation. Degrade to
    // plain text — the unstyled diff is itself the user-visible signal.
    return null;
  });
}

export function ensureHighlighter(): Promise<Highlighter | null> {
  if (highlighterPromise === null) {
    highlighterPromise = initHighlighter();
  }
  return highlighterPromise;
}

export function normalizeLang(lang: string): SupportedLang | 'plaintext' {
  const lower = lang.toLowerCase();
  if (SUPPORTED_SET.has(lower)) return lower as SupportedLang;
  return 'plaintext';
}

export function highlightLines(
  highlighter: Highlighter,
  code: string,
  lang: SupportedLang | 'plaintext',
): ThemedToken[][] {
  if (lang === 'plaintext') {
    return code.split('\n').map((line) => [
      {
        content: line,
        offset: 0,
      },
    ]);
  }
  // codeToTokensBase is synchronous once the highlighter has loaded its langs.
  return highlighter.codeToTokensBase(code, {
    lang,
    theme: THEME_NAME,
    includeExplanation: false,
  });
}

// Test-only: resets the module-level cache so suites can run in isolation.
export function __resetShikiForTests(): void {
  highlighterPromise = null;
}
