import { useState } from 'react';
import type { ThemedToken } from 'shiki';
import type { LineOp } from '../lib/diff-chunks.js';
import DiffLine from './DiffLine.js';

// Collapsed eq-run: one button that shows "… N unchanged lines …" and
// expands inline to reveal the hidden lines as plain context rows. Stable
// key prop is handled by the caller (DiffView) per lock 5.

interface DiffHunkProps {
  readonly hiddenCount: number;
  readonly lines: readonly LineOp[];
  readonly tokensByPostLine: ReadonlyMap<number, ThemedToken[]> | null;
}

export default function DiffHunk({
  hiddenCount,
  lines,
  tokensByPostLine,
}: DiffHunkProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div>
        {lines.map((op) => (
          <DiffLine
            key={keyFor(op)}
            op={op}
            tokens={tokensFor(tokensByPostLine, op)}
          />
        ))}
      </div>
    );
  }

  const label =
    hiddenCount === 1
      ? '… 1 unchanged line …'
      : `… ${hiddenCount} unchanged lines …`;

  return (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="flex w-full items-center gap-2 px-12 py-1 text-left text-meta uppercase tracking-meta text-pw-fg-faint hover:text-pw-fg-muted"
      data-testid="diff-hunk-toggle"
    >
      <span aria-hidden="true">▸</span>
      <span>{label}</span>
    </button>
  );
}

function keyFor(op: LineOp): string {
  // eq rows have both pre and post — either one yields a stable key within
  // the single file. We prefer post so new files with no pre still work.
  if (op.kind === 'eq') return `eq:${op.postLine}`;
  if (op.kind === 'add') return `add:${op.postLine}`;
  return `del:${op.preLine}`;
}

function tokensFor(
  map: ReadonlyMap<number, ThemedToken[]> | null,
  op: LineOp,
): ThemedToken[] | null {
  if (map === null) return null;
  const line = op.kind === 'del' ? null : op.postLine;
  if (line === null) return null;
  return map.get(line) ?? null;
}
