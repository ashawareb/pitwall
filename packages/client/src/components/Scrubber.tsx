import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef } from 'react';

export type ScrubberMode = 'drag' | 'click' | 'keyboard';

interface ScrubberProps {
  tMs: number | null;          // Null = live.
  durationMs: number;
  editTMsList: number[];       // Sorted ascending; for ←/→ stepping.
  onSeek(newTMs: number, mode: ScrubberMode): void;
  onLive(): void;
}

// Scrubber widget. Dumb: owns only mouse/keyboard input + its own visual
// state; URL writes and auto-selection live in Session.tsx's ScrubberContainer
// so this component stays reusable and testable in isolation.
//
// Drag model: mousedown attaches window-level mousemove/mouseup listeners so
// dragging outside the 120px track still follows the pointer. A click (down +
// up without any intervening move) emits once with mode='click'. A drag emits
// on every mousemove with mode='drag'; no extra emit on mouseup. The caller
// uses this to pick push vs. replace URL semantics per spec 14.
//
// Keyboard listener is global on document, guarded against INPUT/TEXTAREA
// focus — same pattern as Timeline's j/k. contenteditable elements are NOT
// guarded; Pitwall has none in v1, so this is intentional.

const TRACK_WIDTH_PX = 120;
const TRACK_HEIGHT_PX = 4;
const THUMB_WIDTH_PX = 2;
const THUMB_HEIGHT_PX = 12;

export default function Scrubber({
  tMs,
  durationMs,
  editTMsList,
  onSeek,
  onLive,
}: ScrubberProps) {
  const isLive = tMs === null;
  const effectiveTMs = tMs ?? durationMs;
  const fillPct =
    durationMs > 0
      ? Math.max(0, Math.min(1, effectiveTMs / durationMs)) * 100
      : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // If the component unmounts mid-drag, strip the window listeners so we
  // don't keep firing onSeek into a dead tree.
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  const tMsFromClientX = useCallback(
    (clientX: number, trackRect: DOMRect): number => {
      if (trackRect.width <= 0 || durationMs <= 0) return 0;
      const ratio = (clientX - trackRect.left) / trackRect.width;
      const raw = ratio * durationMs;
      return Math.max(0, Math.min(durationMs, Math.round(raw)));
    },
    [durationMs],
  );

  const onTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    const trackEl = trackRef.current;
    if (trackEl === null) return;
    e.preventDefault();

    const trackRect = trackEl.getBoundingClientRect();
    const startTMs = tMsFromClientX(e.clientX, trackRect);
    let moved = false;

    const onMove = (mv: MouseEvent): void => {
      moved = true;
      onSeek(tMsFromClientX(mv.clientX, trackRect), 'drag');
    };
    const onUp = (): void => {
      if (!moved) onSeek(startTMs, 'click');
      cleanup();
    };
    const cleanup = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dragCleanupRef.current = null;
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight' &&
        e.key !== 'Home' &&
        e.key !== 'End'
      ) {
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        onLive();
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        onSeek(0, 'keyboard');
        return;
      }
      if (e.key === 'ArrowLeft') {
        const prev = findPrevBefore(editTMsList, effectiveTMs);
        if (prev !== null) {
          e.preventDefault();
          onSeek(prev, 'keyboard');
        }
        return;
      }
      // ArrowRight.
      const next = findNextAfter(editTMsList, effectiveTMs);
      if (next !== null) {
        e.preventDefault();
        onSeek(next, 'keyboard');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [editTMsList, effectiveTMs, onSeek, onLive]);

  // Thumb is 2×12px, centered on the track's vertical midpoint (track is 4px,
  // so thumb extends 4px above and below). Horizontal centering: the fill's
  // right edge is at `fillPct%`; the thumb centers there by offsetting left
  // by half its width.
  const thumbStyle: CSSProperties = {
    left: `calc(${fillPct}% - ${THUMB_WIDTH_PX / 2}px)`,
    width: THUMB_WIDTH_PX,
    height: THUMB_HEIGHT_PX,
    top: `calc(50% - ${THUMB_HEIGHT_PX / 2}px)`,
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-meta uppercase tracking-meta text-pw-fg-faint">
        Lap Replay
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={-1}
        aria-label="Session replay position"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={effectiveTMs}
        data-testid="scrubber-track"
        data-live={isLive ? 'true' : 'false'}
        onMouseDown={onTrackMouseDown}
        className="relative cursor-pointer bg-white/[0.08]"
        style={{ width: TRACK_WIDTH_PX, height: TRACK_HEIGHT_PX }}
      >
        <div
          data-testid="scrubber-fill"
          className="absolute inset-y-0 left-0 bg-pw-accent"
          style={{ width: `${fillPct}%` }}
        />
        <div
          data-testid="scrubber-thumb"
          className="absolute bg-pw-accent"
          style={thumbStyle}
        />
      </div>
      <LiveButton isLive={isLive} onLive={onLive} />
    </div>
  );
}

function LiveButton({
  isLive,
  onLive,
}: {
  isLive: boolean;
  onLive(): void;
}) {
  // Same padding / typography in both states so toggling Live ↔ scrubbed
  // never shifts neighbors in the top bar.
  const base =
    'rounded-pill px-2 py-[2px] text-meta uppercase tracking-meta';
  const cls = isLive
    ? `${base} bg-pw-accent-soft text-pw-accent`
    : `${base} text-pw-fg-faint`;
  return (
    <button
      type="button"
      onClick={onLive}
      aria-pressed={isLive}
      data-testid="scrubber-live"
      className={cls}
    >
      Live
    </button>
  );
}

function findPrevBefore(list: number[], cur: number): number | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i];
    if (t !== undefined && t < cur) return t;
  }
  return null;
}

function findNextAfter(list: number[], cur: number): number | null {
  for (const t of list) {
    if (t > cur) return t;
  }
  return null;
}
