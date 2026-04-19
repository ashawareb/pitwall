export interface BannerParams {
  version: string;
  cwd: string;
  url: string;
}

export function formatBanner({ version, cwd, url }: BannerParams): string {
  const lines = [
    `   ███  PITWALL  ${version}`,
    `   ─────────────────────────────`,
    `   Reviewing: ${cwd}`,
    `   URL:       ${url}`,
    `   Quit:      Ctrl-C`,
    '',
  ];
  return lines.join('\n');
}
