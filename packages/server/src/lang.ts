// Extension → language lookup for Shiki highlighting. Extension-only — we do
// not inspect file content, shebangs, or other signals. Unknown or
// extensionless paths fall back to 'text'. Add new extensions by appending to
// LANG_MAP; do not branch on prefixes or suffixes in this function.

const LANG_MAP: Record<string, string> = {
  rb: 'ruby',
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  md: 'markdown',
  html: 'html',
  css: 'css',
};

export function detectLanguage(path: string): string {
  const idx = path.lastIndexOf('.');
  if (idx === -1 || idx === path.length - 1) return 'text';
  const ext = path.slice(idx + 1).toLowerCase();
  return LANG_MAP[ext] ?? 'text';
}
