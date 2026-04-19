import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectSummary } from '../api/types.js';
import { formatRelativeTime } from '../utils/relative-time.js';

const META_CLASS = 'text-meta uppercase tracking-meta text-pw-fg-faint';
const PILL_STYLE: CSSProperties = {
  padding: '2px 6px',
  background: 'var(--pw-bg-panel-hover)',
  border: '0.5px solid rgba(255,255,255,0.08)',
};

interface ProjectListProps {
  projects: ProjectSummary[];
  now?: Date;
}

// direction: rtl gives us left-truncation for free: the ellipsis appears at
// the front of the string and the tail (the identifying suffix of the path)
// stays visible. Works for plain Unix paths — no bidi hazards because the
// paths we render contain only ASCII characters.
export default function ProjectList({ projects, now }: ProjectListProps) {
  return (
    <div
      data-testid="project-list"
      className="w-full max-w-[480px] rounded-panel bg-pw-bg-panel p-[10px]"
    >
      <div className={META_CLASS}>Projects</div>
      <ul className="mt-2 flex flex-col">
        {projects.map((p) => (
          <li key={p.hash}>
            <Link
              to={`/p/${p.hash}`}
              className="flex items-center gap-2 rounded-interactive px-2 py-2 hover:bg-pw-bg-panel-hover"
            >
              <span
                className="truncate flex-1 min-w-0 text-ui text-pw-fg-primary"
                style={{ direction: 'rtl' }}
                title={p.path}
              >
                {p.path}
              </span>
              <span
                className="rounded-interactive text-pw-fg-muted whitespace-nowrap text-ui"
                style={PILL_STYLE}
              >
                {p.sessionCount} {p.sessionCount === 1 ? 'session' : 'sessions'}
              </span>
              <span className="text-ui text-pw-fg-faint whitespace-nowrap">
                {formatRelativeTime(p.lastActivityAt, now)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
