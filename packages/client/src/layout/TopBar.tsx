import type { ReactNode } from 'react';

interface TopBarProps {
  left?: ReactNode;
  right?: ReactNode;
}

// Panel height and spacing follow docs/04-ui-system.md §Layout. No live-dot
// animation and no scrubber UI yet — those belong to later specs.
export default function TopBar({ left, right }: TopBarProps) {
  return (
    <header className="flex items-center justify-between rounded-panel bg-pw-bg-panel px-[10px] py-[10px]">
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}
