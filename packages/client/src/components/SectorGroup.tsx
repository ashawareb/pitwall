import type { FileEditSummary, Sector } from '../api/types.js';
import { SECTOR_COLOR_CLASS } from '../utils/sector-colors.js';
import TimelineRow from './TimelineRow.js';

export interface SectorGroupEntry {
  edit: FileEditSummary;
  globalIndex: number;
  pathLabel: string;
}

interface SectorGroupProps {
  sector: Sector;
  entries: readonly SectorGroupEntry[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  selectedId: string | null;
  onSelect: (editId: string) => void;
}

function formatOrderLabel(index: number): string {
  return String(index + 1).padStart(2, '0');
}

// Section header is a button so collapse/expand is keyboard-accessible. Body
// renders TimelineRow per entry when expanded; orderLabel uses the global
// orderIndex+1 so chronological position remains visible inside a sector.
export default function SectorGroup({
  sector,
  entries,
  collapsed,
  onToggleCollapsed,
  selectedId,
  onSelect,
}: SectorGroupProps) {
  const chevron = collapsed ? '▸' : '▾';
  return (
    <div data-sector={sector}>
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={`${sector} (${entries.length})`}
        className="flex w-full items-center gap-2 px-2 py-1 text-left text-meta uppercase tracking-meta hover:bg-pw-bg-panel-hover"
      >
        <span className="text-pw-fg-ghost">{chevron}</span>
        <span className={SECTOR_COLOR_CLASS[sector]}>{sector}</span>
        <span className="text-pw-fg-muted">{entries.length}</span>
      </button>
      {!collapsed && (
        <div className="flex flex-col">
          {entries.map((e) => (
            <TimelineRow
              key={e.edit.id}
              edit={e.edit}
              orderLabel={formatOrderLabel(e.globalIndex)}
              pathLabel={e.pathLabel}
              selected={e.edit.id === selectedId}
              onSelect={() => onSelect(e.edit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
