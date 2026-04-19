import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// URL ⇄ state for the Lap Replay scrubber. `?tMs` is the single source of
// truth for scrubber position per spec 14. Absence of the param means "live"
// (scrubber parked at durationMs); a present value clamped to [0, durationMs]
// means the user has scrubbed.
//
// setPosition writes `?tMs` AND (optionally) `?edit` in one setSearchParams
// call so the scrubber and the Timeline's selection never rev independently.
// editId semantics: undefined → leave ?edit alone; null → delete ?edit;
// string → set ?edit to that value.
//
// Write mode per spec 14 clarification (c): drag uses 'replace' so the URL
// history is not flooded during a scrub; click / keyboard / LIVE use 'push'
// so back/forward traverses discrete actions.

export interface ReplayPosition {
  readonly tMs: number | null;
  readonly effectiveTMs: number;
  readonly isLive: boolean;
  setPosition(
    newTMs: number,
    opts: { mode: 'push' | 'replace'; editId?: string | null },
  ): void;
  setLive(opts?: { mode?: 'push' | 'replace' }): void;
}

function parseTMs(raw: string | null, durationMs: number): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return Math.min(n, durationMs);
}

export function useReplayPosition(durationMs: number): ReplayPosition {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tMs');

  const tMs = useMemo(() => parseTMs(raw, durationMs), [raw, durationMs]);
  const effectiveTMs = tMs ?? durationMs;
  const isLive = tMs === null;

  const setPosition = useCallback<ReplayPosition['setPosition']>(
    (newTMs, opts) => {
      const clamped = Math.max(0, Math.min(durationMs, Math.round(newTMs)));
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tMs', String(clamped));
          if (opts.editId === null) next.delete('edit');
          else if (typeof opts.editId === 'string') next.set('edit', opts.editId);
          return next;
        },
        { replace: opts.mode === 'replace' },
      );
    },
    [durationMs, setSearchParams],
  );

  const setLive = useCallback<ReplayPosition['setLive']>(
    (opts) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('tMs');
          return next;
        },
        { replace: opts?.mode === 'replace' },
      );
    },
    [setSearchParams],
  );

  return { tMs, effectiveTMs, isLive, setPosition, setLive };
}
