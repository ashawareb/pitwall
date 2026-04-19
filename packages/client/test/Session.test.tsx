import { cleanup, render, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  SessionDetailResponse,
  SessionFileResponse,
} from '../src/api/types.js';
import Session from '../src/routes/Session.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const DETAIL: SessionDetailResponse = {
  id: 'sess-xyz',
  projectHash: 'proj-abc',
  projectPath: '/home/dev/project',
  startedAt: '2026-04-18T12:00:00Z',
  endedAt: '2026-04-18T12:05:00Z',
  durationMs: 5 * 60 * 1000,
  turns: [],
  firstPrompt: 'do things',
  sectorSummary: {
    migrations: 0,
    models: 1,
    controllers: 0,
    views: 0,
    tests: 0,
    config: 0,
    tasks: 0,
    other: 0,
  },
  fileEdits: [
    {
      id: 'e1',
      orderIndex: 0,
      toolCallId: 'tool-1',
      turnIndex: 0,
      path: 'app/models/user.rb',
      sector: 'models',
      operation: 'Edit',
      additions: 1,
      deletions: 0,
      warnings: [],
      triggeringUserMessage: 'do things',
      triggeringSentence: null,
      thinkingBlocks: [],
      tMs: 0,
    },
  ],
};

const FILE: SessionFileResponse = {
  editId: 'e1',
  path: 'app/models/user.rb',
  preContent: 'class User\nend\n',
  postContent: 'class User\n  def name\n  end\nend\n',
  language: 'ruby',
};

// Route fetches by URL so the session-detail and file-content endpoints can
// return different bodies in the same test. Input type mirrors the lib-dom
// RequestInfo — jsdom hands us a string for `fetch('/api/...')` calls.
function stubFetchRouted(
  handlers: Record<string, unknown>,
  fallback?: unknown,
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.pathname
          : new URL(input.url).pathname;
      for (const [prefix, body] of Object.entries(handlers)) {
        if (url.startsWith(prefix)) {
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      if (fallback !== undefined) {
        return new Response(JSON.stringify(fallback), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'not found', code: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

describe('Session shell', () => {
  it('renders the three-panel layout, top-bar route params, and the Timeline rail', async () => {
    stubFetchRouted({
      '/api/projects/proj-abc/sessions/sess-xyz/files/': FILE,
      '/api/projects/proj-abc/sessions/sess-xyz': DETAIL,
    });

    const { getByText, getByLabelText, findByText } = render(
      <MemoryRouter initialEntries={['/s/proj-abc/sess-xyz']}>
        <Routes>
          <Route
            path="/s/:projectHash/:sessionId"
            element={<Session />}
          />
        </Routes>
      </MemoryRouter>,
    );

    // (a) The three aria-labeled panel sections.
    expect(getByLabelText('Timeline panel')).toBeTruthy();
    expect(getByLabelText('Diff panel')).toBeTruthy();
    expect(getByLabelText('Radio panel')).toBeTruthy();

    // (b) TopBar shows route params and the Lap Replay label.
    expect(getByText(/proj-abc/)).toBeTruthy();
    expect(getByText(/sess-xyz/)).toBeTruthy();
    expect(getByText('Lap Replay')).toBeTruthy();

    // Radio rail heading renders immediately; the prompt text appears once
    // the detail fetch resolves.
    const radio = within(getByLabelText('Radio panel'));
    expect(radio.getByText('RADIO')).toBeTruthy();
    await waitFor(() => {
      expect(radio.getByText('do things')).toBeTruthy();
    });

    // (c) Timeline panel contains the RailToggle header once the fetch lands.
    await findByText('Timeline');
    await waitFor(() => {
      expect(getByText('Sectors')).toBeTruthy();
    });

    // (d) DiffView renders the header row — order label "01", the file path,
    // and the additions count. The "Diff" placeholder is replaced once the
    // middle-panel fetch resolves. Scoped to the Diff panel because Timeline
    // also renders "01" and the path.
    await waitFor(() => {
      const diff = within(getByLabelText('Diff panel'));
      expect(diff.getByText('app/models/user.rb')).toBeTruthy();
      expect(diff.getByText('+1')).toBeTruthy();
    });
  });
});
