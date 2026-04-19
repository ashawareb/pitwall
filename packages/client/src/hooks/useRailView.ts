import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Sector } from '../api/types.js';

// URL ⇄ state for the left rail's view mode and per-sector collapsed set.
//
// Conventions, locked in spec 13:
//   ?view=timeline is the default and is omitted from URLs (only ?view=sectors
//   is written). ?collapsed= is a comma-separated list of sector names,
//   alphabetically sorted on serialize for canonical URLs. Empty set drops
//   the param entirely. parseCollapsed silently ignores invalid sector names
//   so a hand-edited URL like ?collapsed=foo,models still honors models. Both
//   setView and toggleCollapsed push (not replace) so browser back/forward
//   traverses view + collapse state.

export type RailView = 'timeline' | 'sectors';

interface RailViewState {
  readonly view: RailView;
  readonly collapsed: ReadonlySet<Sector>;
  setView(next: RailView): void;
  toggleCollapsed(sector: Sector): void;
}

// Record over Sector — TypeScript flags missing keys when the union grows,
// so an exhaustive lookup table doubles as a compile-time guarantee.
const VALID_SECTORS: Record<Sector, true> = {
  migrations: true,
  models: true,
  controllers: true,
  views: true,
  tests: true,
  config: true,
  tasks: true,
  other: true,
};

function isSector(s: string): s is Sector {
  return Object.hasOwn(VALID_SECTORS, s);
}

export function parseView(raw: string | null): RailView {
  return raw === 'sectors' ? 'sectors' : 'timeline';
}

export function parseCollapsed(raw: string | null): Set<Sector> {
  const out = new Set<Sector>();
  if (raw === null || raw === '') return out;
  for (const tok of raw.split(',')) {
    if (tok.length === 0) continue;
    if (isSector(tok)) out.add(tok);
  }
  return out;
}

export function serializeCollapsed(set: ReadonlySet<Sector>): string {
  return Array.from(set).sort().join(',');
}

export function useRailView(): RailViewState {
  const [searchParams, setSearchParams] = useSearchParams();

  const view = useMemo(
    () => parseView(searchParams.get('view')),
    [searchParams],
  );
  const collapsed = useMemo(
    () => parseCollapsed(searchParams.get('collapsed')),
    [searchParams],
  );

  const setView = useCallback(
    (next: RailView): void => {
      setSearchParams((prev) => {
        const out = new URLSearchParams(prev);
        if (next === 'timeline') out.delete('view');
        else out.set('view', next);
        return out;
      });
    },
    [setSearchParams],
  );

  const toggleCollapsed = useCallback(
    (sector: Sector): void => {
      setSearchParams((prev) => {
        const out = new URLSearchParams(prev);
        const current = parseCollapsed(out.get('collapsed'));
        if (current.has(sector)) current.delete(sector);
        else current.add(sector);
        const serialized = serializeCollapsed(current);
        if (serialized === '') out.delete('collapsed');
        else out.set('collapsed', serialized);
        return out;
      });
    },
    [setSearchParams],
  );

  return { view, collapsed, setView, toggleCollapsed };
}
