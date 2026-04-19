import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FileEditSummary } from '../api/types.js';
import { useSelectedEdit } from '../hooks/useSelectedEdit.js';
import { disambiguateBasenames } from '../utils/path-labels.js';
import RailToggle from './RailToggle.js';
import TimelineRow from './TimelineRow.js';

const ROW_HEIGHT = 44;
const VIRTUAL_THRESHOLD = 50;
const WINDOW_BUFFER = 5;
// Fallback when useLayoutEffect has not measured the scroll container yet —
// keeps the first paint of a >50-edit session from showing a nearly-empty
// window. Replaced by the real clientHeight on the first layout pass.
const INITIAL_CLIENT_HEIGHT = 600;

interface TimelineProps {
  fileEdits: FileEditSummary[];
  sessionId: string;
}

function formatOrderLabel(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export default function Timeline({ fileEdits, sessionId }: TimelineProps) {
  const { selectedId, selectedIndex, select } = useSelectedEdit(fileEdits);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);

  // Reset scroll to the top when entering a new session. Click-driven
  // selection changes do NOT touch scroll (spec 10 AC preserves scroll on
  // click). Keyboard-driven changes scroll via scrollTargetIntoView below.
  useLayoutEffect(() => {
    const c = containerRef.current;
    if (c) c.scrollTop = 0;
  }, [sessionId]);

  useLayoutEffect(() => {
    const c = containerRef.current;
    if (c) setClientHeight(c.clientHeight);
  }, []);

  const virtualized = fileEdits.length > VIRTUAL_THRESHOLD;
  const windowHeight = clientHeight > 0 ? clientHeight : INITIAL_CLIENT_HEIGHT;
  const windowStart = virtualized
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - WINDOW_BUFFER)
    : 0;
  const windowEnd = virtualized
    ? Math.min(
        fileEdits.length,
        Math.ceil((scrollTop + windowHeight) / ROW_HEIGHT) + WINDOW_BUFFER,
      )
    : fileEdits.length;

  const pathLabels = useMemo(
    () => disambiguateBasenames(fileEdits.map((e) => e.path)),
    [fileEdits],
  );

  const handleRowClick = useCallback(
    (editId: string) => {
      select(editId);
    },
    [select],
  );

  const scrollTargetIntoView = useCallback(
    (targetIndex: number, targetId: string) => {
      const container = containerRef.current;
      if (!container) return;
      // Iterate over rendered rows instead of using an attribute selector —
      // avoids needing CSS.escape (absent in jsdom) and keeps arbitrary id
      // shapes (UUIDs with dots/colons) safe. Window is ~20 rows max, so the
      // linear scan is cheaper than the risk of a malformed selector.
      const rendered = container.querySelectorAll<HTMLElement>(
        '[data-edit-id]',
      );
      let node: HTMLElement | null = null;
      for (const el of rendered) {
        if (el.getAttribute('data-edit-id') === targetId) {
          node = el;
          break;
        }
      }
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        return;
      }
      // Fallthrough for two cases: (a) virtualized rail where the row is not
      // in the DOM, and (b) environments without Element.scrollIntoView (jsdom).
      // `block: 'nearest'` semantics rewritten as arithmetic on the fixed
      // ROW_HEIGHT — only scrolls if the row is out of view, and only by the
      // minimum needed. Writing scrollTop fires onScroll, which recomputes
      // the window so the row renders on the next paint.
      const top = targetIndex * ROW_HEIGHT;
      const bottom = top + ROW_HEIGHT;
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      if (top < viewTop) {
        container.scrollTop = top;
      } else if (bottom > viewBottom) {
        container.scrollTop = bottom - container.clientHeight;
      }
    },
    [],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key !== 'j' && e.key !== 'k' && e.key !== 'Enter') return;
      e.preventDefault();
      if (e.key === 'Enter') return; // Explicit no-op per spec 10.
      const count = fileEdits.length;
      if (count === 0) return;
      const current = selectedIndex < 0 ? 0 : selectedIndex;
      const nextIndex =
        e.key === 'j'
          ? (current + 1) % count
          : (current - 1 + count) % count;
      const target = fileEdits[nextIndex];
      if (!target) return;
      select(target.id);
      scrollTargetIntoView(nextIndex, target.id);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [fileEdits, selectedIndex, select, scrollTargetIntoView]);

  return (
    <div className="flex h-full flex-col gap-2">
      <RailToggle />
      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-y-auto"
        data-testid="timeline-scroll"
      >
        {virtualized ? (
          <div
            style={{
              height: fileEdits.length * ROW_HEIGHT,
              position: 'relative',
            }}
          >
            {Array.from({ length: windowEnd - windowStart }, (_, i) => {
              const index = windowStart + i;
              const edit = fileEdits[index];
              if (!edit) return null;
              const label = pathLabels[index] ?? edit.path;
              return (
                <div
                  key={edit.id}
                  style={{
                    position: 'absolute',
                    top: index * ROW_HEIGHT,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                  }}
                >
                  <TimelineRow
                    edit={edit}
                    orderLabel={formatOrderLabel(index)}
                    pathLabel={label}
                    selected={edit.id === selectedId}
                    onSelect={() => handleRowClick(edit.id)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col">
            {fileEdits.map((edit, index) => (
              <TimelineRow
                key={edit.id}
                edit={edit}
                orderLabel={formatOrderLabel(index)}
                pathLabel={pathLabels[index] ?? edit.path}
                selected={edit.id === selectedId}
                onSelect={() => handleRowClick(edit.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
