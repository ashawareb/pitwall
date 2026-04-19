import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionListItem } from '../src/api/types.js';
import SessionRow from '../src/components/SessionRow.js';

afterEach(() => {
  cleanup();
});

const BASE: SessionListItem = {
  id: 'sess-1',
  startedAt: '2026-04-18T12:00:00Z',
  endedAt: '2026-04-18T12:05:05Z',
  durationMs: 305_000,
  firstPrompt: 'Refactor the authentication flow',
  fileCount: 3,
  toolCallCount: 12,
  sectorSummary: {
    migrations: 0,
    models: 1,
    controllers: 1,
    views: 0,
    tests: 1,
    config: 0,
    tasks: 0,
    other: 0,
  },
};

const NOW = new Date('2026-04-18T12:10:05Z'); // 5 minutes after endedAt.

describe('SessionRow', () => {
  it('renders prompt, pills, relative time, and a link to the session view', () => {
    const { getByText, container } = render(
      <MemoryRouter>
        <SessionRow projectHash="proj-x" session={BASE} now={NOW} />
      </MemoryRouter>,
    );

    expect(getByText(/Refactor the authentication flow/)).toBeTruthy();
    expect(getByText('3 files')).toBeTruthy();
    expect(getByText('12 calls')).toBeTruthy();
    expect(getByText('5m 5s')).toBeTruthy();
    expect(getByText('5m ago')).toBeTruthy();

    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/s/proj-x/sess-1');
  });

  it('uses singular labels when counts are 1', () => {
    const session: SessionListItem = {
      ...BASE,
      fileCount: 1,
      toolCallCount: 1,
    };
    const { getByText } = render(
      <MemoryRouter>
        <SessionRow projectHash="proj-x" session={session} now={NOW} />
      </MemoryRouter>,
    );

    expect(getByText('1 file')).toBeTruthy();
    expect(getByText('1 call')).toBeTruthy();
  });

  it('truncates a prompt longer than 120 chars with an ellipsis', () => {
    const long = 'x'.repeat(150);
    const session: SessionListItem = { ...BASE, firstPrompt: long };
    const { container } = render(
      <MemoryRouter>
        <SessionRow projectHash="proj-x" session={session} now={NOW} />
      </MemoryRouter>,
    );
    const promptEl = container.querySelector('[title]');
    expect(promptEl?.textContent).toMatch(/…$/);
    expect(promptEl?.textContent?.length).toBeLessThanOrEqual(120);
    expect(promptEl?.getAttribute('title')).toBe(long);
  });
});
