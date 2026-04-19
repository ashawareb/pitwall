export type Sector =
  | 'migrations'
  | 'models'
  | 'controllers'
  | 'views'
  | 'tests'
  | 'config'
  | 'tasks'
  | 'other';

export interface SectorRule {
  readonly sector: Sector;
  readonly test: (path: string) => boolean;
}

// Declarative rule table — first match wins. Exported so spec 13's Sectors
// view imports the same source of truth and sector labels stay in sync with
// Timeline tags. Do not hardcode sector paths anywhere else in the codebase.
export const SECTOR_RULES: readonly SectorRule[] = [
  {
    sector: 'migrations',
    test: (p) =>
      /(^|\/)db\/migrate\//.test(p) ||
      /(^|\/)migrations\//.test(p) ||
      /\.sql$/i.test(p),
  },
  {
    sector: 'models',
    test: (p) => /(^|\/)app\/models\//.test(p) || /(^|\/)models\//.test(p),
  },
  {
    sector: 'controllers',
    test: (p) =>
      /(^|\/)app\/controllers\//.test(p) || /(^|\/)controllers\//.test(p),
  },
  {
    sector: 'views',
    test: (p) =>
      /(^|\/)app\/views\//.test(p) ||
      /(^|\/)views\//.test(p) ||
      /(^|\/)templates\//.test(p),
  },
  {
    sector: 'tests',
    test: (p) =>
      /(^|\/)spec\//.test(p) ||
      /(^|\/)test\//.test(p) ||
      /(^|\/)tests\//.test(p) ||
      /_test\.[a-z0-9]+$/i.test(p),
  },
  {
    sector: 'config',
    test: (p) =>
      /(^|\/)config\//.test(p) ||
      /\.yml$/i.test(p) ||
      /\.env(\.|$)/.test(p),
  },
  {
    sector: 'tasks',
    test: (p) =>
      /(^|\/)lib\/tasks\//.test(p) ||
      /(^|\/)Rakefile$/.test(p) ||
      /\.rake$/i.test(p),
  },
];

export function classifySector(path: string): Sector {
  for (const rule of SECTOR_RULES) {
    if (rule.test(path)) return rule.sector;
  }
  return 'other';
}
