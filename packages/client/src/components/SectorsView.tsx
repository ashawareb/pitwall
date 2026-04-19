import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { FileEditSummary, Sector } from '../api/types.js';
import { useRailView } from '../hooks/useRailView.js';
import { useSelectedEdit } from '../hooks/useSelectedEdit.js';
import { disambiguateBasenames } from '../utils/path-labels.js';
import RailToggle from './RailToggle.js';
import SectorGroup, { type SectorGroupEntry } from './SectorGroup.js';

interface SectorsViewProps {
  fileEdits: FileEditSummary[];
  sessionId: string;
}

interface Group {
  sector: Sector;
  entries: SectorGroupEntry[];
}

// Walk fileEdits once, bucket by sector, capture first-appearance order. The
// first sector to appear chronologically is the first group rendered, so the
// rail still reflects session flow even though it's grouped (spec 13 AC).
// pathLabels is the global disambiguated set so labels match Timeline view
// for the same session.
function groupBySector(
  fileEdits: FileEditSummary[],
  pathLabels: string[],
): Group[] {
  const order: Sector[] = [];
  const buckets = new Map<Sector, SectorGroupEntry[]>();
  fileEdits.forEach((edit, globalIndex) => {
    const label = pathLabels[globalIndex] ?? edit.path;
    let bucket = buckets.get(edit.sector);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(edit.sector, bucket);
      order.push(edit.sector);
    }
    bucket.push({ edit, globalIndex, pathLabel: label });
  });
  return order.map((sector) => ({
    sector,
    entries: buckets.get(sector) ?? [],
  }));
}

export default function SectorsView({
  fileEdits,
  sessionId,
}: SectorsViewProps) {
  const { selectedId, select } = useSelectedEdit(fileEdits);
  const { collapsed, toggleCollapsed } = useRailView();

  const containerRef = useRef<HTMLDivElement>(null);

  // Reset scroll on session change — mirrors Timeline. View toggles do not
  // reset (the user is staying within the same session).
  useLayoutEffect(() => {
    const c = containerRef.current;
    if (c) c.scrollTop = 0;
  }, [sessionId]);

  const pathLabels = useMemo(
    () => disambiguateBasenames(fileEdits.map((e) => e.path)),
    [fileEdits],
  );

  const groups = useMemo(
    () => groupBySector(fileEdits, pathLabels),
    [fileEdits, pathLabels],
  );

  const handleSelect = useCallback(
    (editId: string) => {
      select(editId);
    },
    [select],
  );

  return (
    <div className="flex h-full flex-col gap-2">
      <RailToggle />
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto"
        data-testid="sectors-scroll"
      >
        {groups.map((g) => (
          <SectorGroup
            key={g.sector}
            sector={g.sector}
            entries={g.entries}
            collapsed={collapsed.has(g.sector)}
            onToggleCollapsed={() => toggleCollapsed(g.sector)}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
