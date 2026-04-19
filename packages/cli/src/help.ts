export function helpText(version: string): string {
  return [
    `pitwall ${version}`,
    '',
    'Local web app for reviewing Claude Code sessions.',
    '',
    'Usage:',
    '  pitwall                 Review sessions for the current directory.',
    '  pitwall --all           Show all projects (no auto-detect).',
    '  pitwall --session UUID  Deep-link to a specific session of the',
    '                          current directory\'s project.',
    '',
    'Options:',
    '  --all              Open the all-projects picker instead of the CWD.',
    '  --session <uuid>   Deep-link to session UUID (uses CWD project hash).',
    '  --port <n>         Pin the server port (default: 4317 with walk-up).',
    '  --no-open          Do not open a browser; just run the server.',
    '  -h, --help         Show this help and exit.',
    '  -v, --version      Print the version and exit.',
    '',
    'Pitwall is local-only. It reads ~/.claude/projects/ and makes no',
    'network calls. Quit with Ctrl-C.',
    '',
  ].join('\n');
}

export function versionText(version: string): string {
  return `pitwall ${version}\n`;
}
