import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSummary, SessionListItem } from '../src/api/types.js';
import Picker from '../src/routes/Picker.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Minimal fetch stub: matches by suffix on the URL, returns the body as JSON.
// Any unmapped URL produces a 404 — tests that depend on a specific request
// must declare it explicitly so missing mocks surface loudly.
function mockFetch(responses: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      for (const [suffix, body] of Object.entries(responses)) {
        if (url.endsWith(suffix)) {
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(
        JSON.stringify({ error: 'not found', code: 'not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }),
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Picker />} />
        <Route path="/p/:hash" element={<Picker />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeProject(overrides: Partial<ProjectSummary>): ProjectSummary {
  return {
    hash: 'proj-default',
    path: '/home/dev/project',
    pathSource: 'cwd',
    sessionCount: 1,
    lastActivityAt: '2026-04-18T12:00:00Z',
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionListItem>): SessionListItem {
  return {
    id: 'sess-default',
    startedAt: '2026-04-18T12:00:00Z',
    endedAt: '2026-04-18T12:05:00Z',
    durationMs: 5 * 60 * 1000,
    firstPrompt: 'default prompt',
    fileCount: 1,
    toolCallCount: 1,
    sectorSummary: {
      migrations: 0,
      models: 0,
      controllers: 0,
      views: 0,
      tests: 0,
      config: 0,
      tasks: 0,
      other: 0,
    },
    ...overrides,
  };
}

describe('Picker — projects view at /', () => {
  it('auto-redirects to /p/:hash when exactly one project exists', async () => {
    mockFetch({
      '/api/projects': {
        projects: [makeProject({ hash: 'proj-only', sessionCount: 2 })],
      },
      '/api/projects/proj-only/sessions': {
        projectHash: 'proj-only',
        projectPath: '/home/dev/project',
        sessions: [makeSession({ id: 's1', firstPrompt: 'First session prompt' })],
      },
    });

    const { findByTestId } = renderAt('/');

    // Redirect lands on SessionsView, which renders the sessions panel.
    const view = await findByTestId('sessions-view');
    expect(view).toBeTruthy();
    expect(view.textContent).toContain('First session prompt');
  });

  it('shows the no-projects empty state when the list is empty', async () => {
    mockFetch({ '/api/projects': { projects: [] } });

    const { findByText } = renderAt('/');

    expect(await findByText(/No Claude Code sessions found/)).toBeTruthy();
    expect(await findByText('claude')).toBeTruthy();
  });

  it('renders the project list when multiple projects exist', async () => {
    mockFetch({
      '/api/projects': {
        projects: [
          makeProject({ hash: 'proj-a', path: '/a/project', sessionCount: 1 }),
          makeProject({
            hash: 'proj-b',
            path: '/b/project',
            sessionCount: 3,
            lastActivityAt: '2026-04-17T12:00:00Z',
          }),
        ],
      },
    });

    const { findByTestId, getByText } = renderAt('/');

    const list = await findByTestId('project-list');
    expect(list).toBeTruthy();
    expect(getByText('/a/project')).toBeTruthy();
    expect(getByText('/b/project')).toBeTruthy();
    expect(getByText('1 session')).toBeTruthy();
    expect(getByText('3 sessions')).toBeTruthy();
  });
});

describe('Picker — sessions view at /p/:hash', () => {
  it('filters sessions by first-prompt substring, case-insensitive', async () => {
    mockFetch({
      '/api/projects/proj-x/sessions': {
        projectHash: 'proj-x',
        projectPath: '/x/project',
        sessions: [
          makeSession({ id: 's1', firstPrompt: 'Refactor the authentication flow' }),
          makeSession({ id: 's2', firstPrompt: 'Add a README.md' }),
          makeSession({ id: 's3', firstPrompt: 'Fix the failing tests' }),
        ],
      },
    });

    const { findByPlaceholderText, queryByText } = renderAt('/p/proj-x');

    const input = await findByPlaceholderText(/filter/i);
    expect(queryByText(/Refactor the authentication flow/)).toBeTruthy();
    expect(queryByText(/README\.md/)).toBeTruthy();
    expect(queryByText(/Fix the failing tests/)).toBeTruthy();

    fireEvent.change(input, { target: { value: 'README' } });
    expect(queryByText(/README\.md/)).toBeTruthy();
    expect(queryByText(/Refactor the authentication flow/)).toBeNull();
    expect(queryByText(/Fix the failing tests/)).toBeNull();

    fireEvent.change(input, { target: { value: 'readme' } });
    expect(queryByText(/README\.md/)).toBeTruthy();

    fireEvent.change(input, { target: { value: 'xyz' } });
    expect(queryByText(/No sessions match that filter\./)).toBeTruthy();

    fireEvent.change(input, { target: { value: '' } });
    expect(queryByText(/Refactor the authentication flow/)).toBeTruthy();
  });

  it('shows the no-sessions empty state for an empty project', async () => {
    mockFetch({
      '/api/projects/proj-empty/sessions': {
        projectHash: 'proj-empty',
        projectPath: '/empty/project',
        sessions: [],
      },
    });

    const { findByText } = renderAt('/p/proj-empty');

    expect(await findByText(/No sessions in this project yet/)).toBeTruthy();
  });
});
