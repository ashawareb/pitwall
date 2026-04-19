import { useRailView } from '../hooks/useRailView.js';

// TIMELINE / SECTORS toggle for the left rail. Active label is rendered in
// --pw-accent; inactive in --pw-fg-faint. Both buttons stay enabled — clicking
// the active view is a no-op, styling alone conveys state. Spec 13 wires this
// to ?view= via useRailView; spec 10 originally rendered the SECTORS half as
// disabled because the view did not exist yet.
export default function RailToggle() {
  const { view, setView } = useRailView();
  const timelineActive = view === 'timeline';
  const sectorsActive = view === 'sectors';
  return (
    <div className="flex items-center gap-3 text-meta uppercase tracking-meta">
      <button
        type="button"
        onClick={() => setView('timeline')}
        aria-pressed={timelineActive}
        className={timelineActive ? 'text-pw-accent' : 'text-pw-fg-faint'}
      >
        Timeline
      </button>
      <button
        type="button"
        onClick={() => setView('sectors')}
        aria-pressed={sectorsActive}
        className={sectorsActive ? 'text-pw-accent' : 'text-pw-fg-faint'}
      >
        Sectors
      </button>
    </div>
  );
}
