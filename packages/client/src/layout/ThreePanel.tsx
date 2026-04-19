import type { ReactNode } from 'react';

interface ThreePanelProps {
  topBar: ReactNode;
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
}

// Timeline rail 168px, Radio rail 180px, diff area fills the middle. Gaps
// 8px and panel radius 6px per docs/04-ui-system.md §Layout.
const LEFT_WIDTH = 168;
const RIGHT_WIDTH = 180;

export default function ThreePanel({
  topBar,
  left,
  middle,
  right,
}: ThreePanelProps) {
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {topBar}
      <div
        className="grid flex-1 gap-2"
        style={{
          gridTemplateColumns: `${LEFT_WIDTH}px minmax(0, 1fr) ${RIGHT_WIDTH}px`,
        }}
      >
        <section
          aria-label="Timeline panel"
          className="min-h-0 rounded-panel bg-pw-bg-panel p-[10px]"
        >
          {left}
        </section>
        <section
          aria-label="Diff panel"
          className="min-h-0 rounded-panel bg-pw-bg-panel p-[10px]"
        >
          {middle}
        </section>
        <section
          aria-label="Radio panel"
          className="min-h-0 rounded-panel bg-pw-bg-panel p-[10px]"
        >
          {right}
        </section>
      </div>
    </div>
  );
}
