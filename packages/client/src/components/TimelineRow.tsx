import type { FileEditSummary } from '../api/types.js';
import { SECTOR_COLOR_CLASS } from '../utils/sector-colors.js';

interface TimelineRowProps {
  edit: FileEditSummary;
  orderLabel: string;
  pathLabel: string;
  selected: boolean;
  onSelect: () => void;
}

// U+2212 MINUS SIGN per the spec's example (`Edit +14 −3`). Additions is
// always shown; deletions only when > 0 — matches the `Write +42` example.
function formatCounts(additions: number, deletions: number): string {
  return deletions > 0 ? `+${additions} −${deletions}` : `+${additions}`;
}

// Row is fixed at 44px per spec 10 AC. The 2px left-border slot is always
// present (transparent when unselected) so selection does not shift the row
// horizontally. `data-edit-id` is the hook Timeline uses to find a row for
// scrollIntoView — stable across virtualization mount/unmount.
export default function TimelineRow({
  edit,
  orderLabel,
  pathLabel,
  selected,
  onSelect,
}: TimelineRowProps) {
  const base =
    'flex h-[44px] w-full flex-col justify-center gap-[2px] border-l-2 pl-2 pr-2 text-left';
  const borderCls = selected ? 'border-pw-accent' : 'border-transparent';
  const bgCls = selected
    ? 'bg-pw-bg-selected'
    : 'hover:bg-pw-bg-panel-hover';
  const numColor = selected ? 'text-pw-accent' : 'text-pw-fg-ghost';
  const pathColor = selected ? 'text-pw-accent' : 'text-pw-fg-primary';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Edit ${orderLabel}: ${edit.path}`}
      data-edit-id={edit.id}
      data-selected={selected ? 'true' : 'false'}
      className={`${base} ${borderCls} ${bgCls}`}
    >
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-ui tabular-nums ${numColor}`}>
          {orderLabel}
        </span>
        <span className={`truncate text-ui ${pathColor}`} title={edit.path}>
          {pathLabel}
        </span>
      </div>
      <div className="flex items-baseline gap-2 text-meta uppercase tracking-meta">
        <span className={SECTOR_COLOR_CLASS[edit.sector]}>{edit.sector}</span>
        <span className="text-pw-fg-muted">
          {edit.operation} {formatCounts(edit.additions, edit.deletions)}
        </span>
      </div>
    </button>
  );
}
