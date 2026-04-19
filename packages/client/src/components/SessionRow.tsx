import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SessionListItem } from '../api/types.js';
import { formatDuration, formatRelativeTime } from '../utils/relative-time.js';
import SectorBar from './SectorBar.js';

const MAX_PROMPT_LEN = 120;
const PILL_BORDER = '0.5px solid rgba(255,255,255,0.08)';

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded-interactive bg-pw-bg-panel-hover text-pw-fg-muted whitespace-nowrap text-ui"
      style={{ padding: '2px 6px', border: PILL_BORDER }}
    >
      {children}
    </span>
  );
}

interface SessionRowProps {
  projectHash: string;
  session: SessionListItem;
  now?: Date;
}

// Row height is fixed at 60px per spec 09 Notes — do not resize on hover.
export default function SessionRow({
  projectHash,
  session,
  now,
}: SessionRowProps) {
  const promptLabel = truncate(session.firstPrompt, MAX_PROMPT_LEN) || '(empty prompt)';
  const fileLabel = `${session.fileCount} ${session.fileCount === 1 ? 'file' : 'files'}`;
  const callLabel = `${session.toolCallCount} ${session.toolCallCount === 1 ? 'call' : 'calls'}`;
  const durationLabel = formatDuration(session.durationMs);

  return (
    <Link
      to={`/s/${projectHash}/${session.id}`}
      className="block rounded-interactive px-2 hover:bg-pw-bg-panel-hover"
      style={{ height: 60 }}
    >
      <div className="flex h-full flex-col justify-center gap-1">
        <div
          className="truncate text-ui text-pw-fg-primary"
          title={session.firstPrompt}
        >
          {promptLabel}
        </div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-ui text-pw-fg-faint">
            {formatRelativeTime(session.endedAt, now)}
          </span>
          <Pill>{fileLabel}</Pill>
          <Pill>{callLabel}</Pill>
          <Pill>{durationLabel}</Pill>
          <div className="min-w-0 flex-1">
            <SectorBar summary={session.sectorSummary} />
          </div>
        </div>
      </div>
    </Link>
  );
}
