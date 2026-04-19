import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  ApiHttpError,
  ApiUnreachableError,
} from '../api/client.js';
import { getProjects, getSessions } from '../api/endpoints.js';
import type {
  ProjectSummary,
  SessionListItem,
} from '../api/types.js';
import FilterField from '../components/FilterField.js';
import SessionRow from '../components/SessionRow.js';
import ProjectList from './ProjectList.js';

const META_CLASS = 'text-meta uppercase tracking-meta text-pw-fg-faint';

type FetchState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; data: T };

// `useParams` returns strings typed as possibly-undefined — the `/` mount of
// Picker has no params, so branching on presence is the correct narrowing.
export default function Picker() {
  const { hash } = useParams<{ hash: string }>();
  return (
    <main className="flex min-h-full items-start justify-center p-4">
      {hash ? <SessionsView projectHash={hash} /> : <ProjectsView />}
    </main>
  );
}

function ProjectsView() {
  const [state, setState] = useState<FetchState<ProjectSummary[]>>({
    kind: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    getProjects()
      .then((res) => {
        if (!cancelled) setState({ kind: 'ready', data: res.projects });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', error: err });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') return <Signage><LoadingText /></Signage>;
  if (state.kind === 'error') return <Signage><ErrorText error={state.error} /></Signage>;

  const projects = state.data;
  if (projects.length === 0) return <Signage><NoProjectsText /></Signage>;
  const [first] = projects;
  if (projects.length === 1 && first) {
    return <Navigate to={`/p/${first.hash}`} replace />;
  }
  return <ProjectList projects={projects} />;
}

function SessionsView({ projectHash }: { projectHash: string }) {
  const [state, setState] = useState<FetchState<SessionListItem[]>>({
    kind: 'loading',
  });
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getSessions(projectHash)
      .then((res) => {
        if (!cancelled) setState({ kind: 'ready', data: res.sessions });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [projectHash]);

  if (state.kind === 'loading') return <Signage><LoadingText /></Signage>;
  if (state.kind === 'error') return <Signage><ErrorText error={state.error} /></Signage>;

  const sessions = state.data;
  if (sessions.length === 0) return <Signage><NoSessionsText /></Signage>;

  const q = filter.trim().toLowerCase();
  const filtered = q === ''
    ? sessions
    : sessions.filter((s) => s.firstPrompt.toLowerCase().includes(q));

  return (
    <div
      data-testid="sessions-view"
      className="w-full max-w-[480px] rounded-panel bg-pw-bg-panel p-[10px]"
    >
      <div className={META_CLASS}>Sessions</div>
      <div className="mt-2">
        <FilterField
          value={filter}
          onChange={setFilter}
          placeholder="Filter by prompt…"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="mt-3 text-ui text-pw-fg-faint">
          No sessions match that filter.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {filtered.map((s) => (
            <li key={s.id}>
              <SessionRow projectHash={projectHash} session={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Signage containers hold one of the informational messages. Same width as
// the data panels so layout stays stable across states, but no panel
// background — signage is text on the app bg, not a chrome-wrapped surface.
function Signage({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[480px] p-[10px]" data-testid="picker-signage">
      {children}
    </div>
  );
}

function LoadingText() {
  return <p className="text-ui text-pw-fg-faint">Loading sessions…</p>;
}

function NoProjectsText() {
  return (
    <p className="text-ui text-pw-fg-muted">
      No Claude Code sessions found. Run{' '}
      <InlineCode>claude</InlineCode>{' '}
      in a project directory and come back.
    </p>
  );
}

function NoSessionsText() {
  return (
    <p className="text-ui text-pw-fg-muted">
      No sessions in this project yet.
    </p>
  );
}

function ErrorText({ error }: { error: unknown }) {
  if (error instanceof ApiUnreachableError) {
    return (
      <p className="text-ui text-pw-error">
        Cannot reach Pitwall server at localhost:4317. Start it with{' '}
        <InlineCode>pnpm -F @pitwall/server dev</InlineCode>, then refresh.
      </p>
    );
  }
  if (error instanceof ApiHttpError) {
    return (
      <p className="text-ui text-pw-error">
        Server error: {error.code} (HTTP {error.status}). Check server logs.
      </p>
    );
  }
  // Unknown error shape — the API client only throws ApiError subclasses, so
  // this branch is a strict-TS safety net, not a visible state.
  return (
    <p className="text-ui text-pw-error">
      Server error: internal. Check server logs.
    </p>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-interactive bg-pw-bg-panel-hover px-1 font-mono text-pw-fg-primary">
      {children}
    </code>
  );
}
