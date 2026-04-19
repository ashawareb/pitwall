import { useMemo } from 'react';
import type { SessionDetailResponse } from '../api/types.js';
import { formatDuration } from '../utils/relative-time.js';

interface SessionTitleProps {
  session: SessionDetailResponse;
}

const MAX_TITLE_LEN = 80;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

// Top-bar left cluster: pulsing live dot + truncated first prompt + muted
// meta (duration · files · calls). Dot pulse is the single allowed motion per
// docs/04-ui-system.md §Motion and comes from the tailwind-registered
// `animate-pw-live-pulse` keyframes. The 9px uppercase meta tracks the
// letter-spacing convention used everywhere else (SECTORS, TIMELINE, RADIO).
export default function SessionTitle({ session }: SessionTitleProps) {
  const toolCallCount = useMemo(
    () => session.turns.reduce((acc, turn) => acc + turn.toolCalls.length, 0),
    [session.turns],
  );

  const titleText =
    truncate(session.firstPrompt, MAX_TITLE_LEN) || '(empty prompt)';
  const fileCount = session.fileEdits.length;
  const fileLabel = `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`;
  const callLabel = `${toolCallCount} ${toolCallCount === 1 ? 'call' : 'calls'}`;
  const meta = `${formatDuration(session.durationMs)} · ${fileLabel} · ${callLabel}`;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="h-[6px] w-[6px] shrink-0 animate-pw-live-pulse rounded-full bg-pw-accent"
      />
      <span
        className="truncate text-ui text-pw-fg-primary"
        title={session.firstPrompt}
      >
        {titleText}
      </span>
      <span
        className="whitespace-nowrap text-meta uppercase tracking-meta text-pw-fg-faint"
        data-testid="session-meta"
      >
        · {meta}
      </span>
    </div>
  );
}
