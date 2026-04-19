import type { Sector } from '../api/types.js';

// Maps a Sector to its Tailwind text-color class. Values reference design
// tokens in packages/client/src/styles/tokens.css; both TimelineRow's sector
// tag and SectorGroup's section header consume this so token-rename
// migrations stay single-edit.
export const SECTOR_COLOR_CLASS: Record<Sector, string> = {
  migrations: 'text-pw-sector-migrations',
  models: 'text-pw-sector-models',
  controllers: 'text-pw-sector-controllers',
  views: 'text-pw-sector-views',
  tests: 'text-pw-sector-tests',
  config: 'text-pw-sector-config',
  tasks: 'text-pw-sector-tasks',
  other: 'text-pw-sector-other',
};
