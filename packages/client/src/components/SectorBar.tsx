import type { Sector, SectorCounts } from '../api/types.js';

// Colors map to tokens exposed via tailwind.config.ts. Order is stable so the
// colored segments in the bar appear in the same sequence across rows; this
// matches the docs/02 sector table order.
const SECTOR_ORDER: Sector[] = [
  'migrations',
  'models',
  'controllers',
  'views',
  'tests',
  'config',
  'tasks',
  'other',
];

const SECTOR_BG: Record<Sector, string> = {
  migrations: 'bg-pw-sector-migrations',
  models: 'bg-pw-sector-models',
  controllers: 'bg-pw-sector-controllers',
  views: 'bg-pw-sector-views',
  tests: 'bg-pw-sector-tests',
  config: 'bg-pw-sector-config',
  tasks: 'bg-pw-sector-tasks',
  other: 'bg-pw-sector-other',
};

interface SectorBarProps {
  summary: SectorCounts;
  className?: string;
}

export default function SectorBar({ summary, className }: SectorBarProps) {
  const total = SECTOR_ORDER.reduce((sum, s) => sum + summary[s], 0);
  const wrapCls = `flex h-2 w-full overflow-hidden rounded-pill${
    className ? ` ${className}` : ''
  }`;

  if (total === 0) {
    return (
      <div
        className={wrapCls}
        role="presentation"
        aria-hidden="true"
        data-testid="sector-bar"
      >
        <div className="h-full w-full bg-pw-fg-ghost" />
      </div>
    );
  }

  return (
    <div
      className={wrapCls}
      role="presentation"
      aria-hidden="true"
      data-testid="sector-bar"
    >
      {SECTOR_ORDER.map((sector) => {
        const count = summary[sector];
        if (count === 0) return null;
        const pct = (count / total) * 100;
        return (
          <div
            key={sector}
            className={`h-full ${SECTOR_BG[sector]}`}
            style={{ width: `${pct}%` }}
            data-sector={sector}
          />
        );
      })}
    </div>
  );
}
