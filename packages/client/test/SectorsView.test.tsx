import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { FileEditSummary } from '../src/api/types.js';
import SectorsView from '../src/components/SectorsView.js';
import Timeline from '../src/components/Timeline.js';
import { useRailView } from '../src/hooks/useRailView.js';

afterEach(() => {
  cleanup();
});

function makeEdit(overrides: Partial<FileEditSummary>): FileEditSummary {
  return {
    id: 'edit-default',
    orderIndex: 0,
    toolCallId: 'tool-default',
    turnIndex: 0,
    path: 'app/models/default.rb',
    sector: 'models',
    operation: 'Edit',
    additions: 1,
    deletions: 0,
    warnings: [],
    triggeringUserMessage: 'do the thing',
    triggeringSentence: null,
    thinkingBlocks: [],
    tMs: 0,
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

interface RenderArgs {
  fileEdits: FileEditSummary[];
  sessionId?: string;
  initialEntry?: string;
}

function renderSectors({
  fileEdits,
  sessionId = 'sess-1',
  initialEntry = '/s/proj/sess-1?view=sectors',
}: RenderArgs) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/s/:projectHash/:sessionId"
          element={
            <>
              <SectorsView fileEdits={fileEdits} sessionId={sessionId} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function selectedButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(
    'button[data-selected="true"]',
  );
}

function locationText(container: HTMLElement): string {
  return container.querySelector('[data-testid="location"]')?.textContent ?? '';
}

describe('SectorsView', () => {
  it('renders sectors in first-edit chronological order with global order labels', () => {
    const edits = [
      makeEdit({
        id: 'e1',
        orderIndex: 0,
        path: 'app/models/user.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e2',
        orderIndex: 1,
        path: 'app/controllers/users.rb',
        sector: 'controllers',
      }),
      makeEdit({
        id: 'e3',
        orderIndex: 2,
        path: 'app/models/post.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e4',
        orderIndex: 3,
        path: 'spec/user_spec.rb',
        sector: 'tests',
      }),
      makeEdit({
        id: 'e5',
        orderIndex: 4,
        path: 'app/controllers/posts.rb',
        sector: 'controllers',
      }),
    ];
    const { container } = renderSectors({ fileEdits: edits });

    // Section order follows first-edit chronology (models > controllers > tests).
    const sections = container.querySelectorAll<HTMLElement>('[data-sector]');
    expect(sections.length).toBe(3);
    expect(sections[0]?.getAttribute('data-sector')).toBe('models');
    expect(sections[1]?.getAttribute('data-sector')).toBe('controllers');
    expect(sections[2]?.getAttribute('data-sector')).toBe('tests');

    // Global order labels: e2 in controllers section is "02", e5 is "05".
    const controllers = sections[1];
    expect(controllers?.querySelector('[data-edit-id="e2"]')).not.toBeNull();
    expect(controllers?.querySelector('[data-edit-id="e5"]')).not.toBeNull();
    expect(controllers?.textContent).toContain('02');
    expect(controllers?.textContent).toContain('05');

    // Header sector name renders in the sector-color token class.
    const modelsHeader = sections[0]?.querySelector('button');
    expect(modelsHeader?.querySelector('.text-pw-sector-models')).not.toBeNull();
    const testsHeader = sections[2]?.querySelector('button');
    expect(testsHeader?.querySelector('.text-pw-sector-tests')).not.toBeNull();
  });

  it('does not render empty sectors', () => {
    const edits = [
      makeEdit({
        id: 'e1',
        orderIndex: 0,
        path: 'app/models/user.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e2',
        orderIndex: 1,
        path: 'spec/user_spec.rb',
        sector: 'tests',
      }),
    ];
    const { container } = renderSectors({ fileEdits: edits });

    const sections = container.querySelectorAll('[data-sector]');
    expect(sections.length).toBe(2);
    const sectorAttrs = Array.from(sections).map((s) =>
      s.getAttribute('data-sector'),
    );
    expect(sectorAttrs).toEqual(['models', 'tests']);

    // Sectors not present in edits do not render.
    expect(container.querySelector('[data-sector="views"]')).toBeNull();
    expect(container.querySelector('[data-sector="controllers"]')).toBeNull();
    expect(container.querySelector('[data-sector="other"]')).toBeNull();
  });

  it('collapse/expand round-trips through the URL', () => {
    const edits = [
      makeEdit({
        id: 'e1',
        orderIndex: 0,
        path: 'app/models/user.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e2',
        orderIndex: 1,
        path: 'app/models/post.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e3',
        orderIndex: 2,
        path: 'spec/user_spec.rb',
        sector: 'tests',
      }),
    ];
    const { container, getByLabelText } = renderSectors({ fileEdits: edits });

    // Pre-collapse: model rows visible.
    expect(container.querySelector('[data-edit-id="e1"]')).not.toBeNull();
    expect(container.querySelector('[data-edit-id="e2"]')).not.toBeNull();

    // Click the models header (label includes count).
    fireEvent.click(getByLabelText('models (2)'));

    // Post-collapse: model rows hidden, URL has ?collapsed=models,
    // tests section still expanded.
    expect(container.querySelector('[data-edit-id="e1"]')).toBeNull();
    expect(container.querySelector('[data-edit-id="e2"]')).toBeNull();
    expect(container.querySelector('[data-edit-id="e3"]')).not.toBeNull();
    expect(locationText(container)).toContain('collapsed=models');

    // Expand again — param drops out.
    fireEvent.click(getByLabelText('models (2)'));
    expect(container.querySelector('[data-edit-id="e1"]')).not.toBeNull();
    expect(locationText(container)).not.toContain('collapsed=');
  });

  it('initializes collapsed state from ?collapsed= on mount', () => {
    const edits = [
      makeEdit({
        id: 'e1',
        orderIndex: 0,
        path: 'app/models/user.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e2',
        orderIndex: 1,
        path: 'spec/user_spec.rb',
        sector: 'tests',
      }),
    ];
    const { container } = renderSectors({
      fileEdits: edits,
      initialEntry: '/s/proj/sess-1?view=sectors&collapsed=models,tests',
    });

    // Both sections collapsed → no rows, but headers remain.
    expect(container.querySelector('[data-edit-id="e1"]')).toBeNull();
    expect(container.querySelector('[data-edit-id="e2"]')).toBeNull();
    expect(container.querySelector('[data-sector="models"]')).not.toBeNull();
    expect(container.querySelector('[data-sector="tests"]')).not.toBeNull();
  });

  it('row click selects and updates ?edit while preserving ?view and ?collapsed', () => {
    const edits = [
      makeEdit({
        id: 'e1',
        orderIndex: 0,
        path: 'app/models/user.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e2',
        orderIndex: 1,
        path: 'app/models/post.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e3',
        orderIndex: 2,
        path: 'spec/user_spec.rb',
        sector: 'tests',
      }),
    ];
    const { container } = renderSectors({
      fileEdits: edits,
      initialEntry: '/s/proj/sess-1?view=sectors&collapsed=tests',
    });

    // Default selection is e1 (first edit).
    expect(selectedButton(container)?.getAttribute('data-edit-id')).toBe('e1');

    // Click e2.
    const e2 = container.querySelector<HTMLButtonElement>(
      'button[data-edit-id="e2"]',
    );
    expect(e2).not.toBeNull();
    if (e2) fireEvent.click(e2);

    // Selection updated; URL preserves view and collapsed.
    expect(selectedButton(container)?.getAttribute('data-edit-id')).toBe('e2');
    const loc = locationText(container);
    expect(loc).toContain('edit=e2');
    expect(loc).toContain('view=sectors');
    expect(loc).toContain('collapsed=tests');
  });

  it('toggles between Timeline and Sectors via RailToggle while preserving selection', () => {
    const edits = [
      makeEdit({
        id: 'e1',
        orderIndex: 0,
        path: 'app/models/user.rb',
        sector: 'models',
      }),
      makeEdit({
        id: 'e2',
        orderIndex: 1,
        path: 'app/controllers/users.rb',
        sector: 'controllers',
      }),
    ];

    function RailSwitch({
      fileEdits,
      sessionId,
    }: {
      fileEdits: FileEditSummary[];
      sessionId: string;
    }) {
      const { view } = useRailView();
      return view === 'sectors' ? (
        <SectorsView fileEdits={fileEdits} sessionId={sessionId} />
      ) : (
        <Timeline fileEdits={fileEdits} sessionId={sessionId} />
      );
    }

    const { container, getByText } = render(
      <MemoryRouter initialEntries={['/s/proj/sess-1']}>
        <Routes>
          <Route
            path="/s/:projectHash/:sessionId"
            element={
              <>
                <RailSwitch fileEdits={edits} sessionId="sess-1" />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    // Start on Timeline. Click e2.
    const e2 = container.querySelector<HTMLButtonElement>(
      'button[data-edit-id="e2"]',
    );
    if (e2) fireEvent.click(e2);
    expect(selectedButton(container)?.getAttribute('data-edit-id')).toBe('e2');

    // Click Sectors button.
    fireEvent.click(getByText('Sectors'));

    // Now on Sectors view; e2 still selected; URL has ?view=sectors&edit=e2.
    expect(container.querySelectorAll('[data-sector]').length).toBe(2);
    expect(selectedButton(container)?.getAttribute('data-edit-id')).toBe('e2');
    const sectorsLoc = locationText(container);
    expect(sectorsLoc).toContain('view=sectors');
    expect(sectorsLoc).toContain('edit=e2');

    // Click Timeline to switch back.
    fireEvent.click(getByText('Timeline'));
    expect(
      container.querySelectorAll('button[data-edit-id]').length,
    ).toBeGreaterThan(0);
    expect(selectedButton(container)?.getAttribute('data-edit-id')).toBe('e2');

    // ?view= dropped (timeline is default), edit preserved.
    const timelineLoc = locationText(container);
    expect(timelineLoc).not.toContain('view=');
    expect(timelineLoc).toContain('edit=e2');
  });

  it('honors ?collapsed= with invalid sector names and keeps them in the URL', () => {
    const edits = [
      makeEdit({
        id: 'e1',
        orderIndex: 0,
        path: 'app/models/user.rb',
        sector: 'models',
      }),
    ];
    const { container } = renderSectors({
      fileEdits: edits,
      initialEntry: '/s/proj/sess-1?view=sectors&collapsed=foo,models',
    });

    // Models collapsed; the unknown 'foo' was silently ignored at parse time.
    expect(container.querySelector('[data-edit-id="e1"]')).toBeNull();

    // URL keeps both tokens — invalid values are not filtered out of the URL,
    // only at parse time. The useSelectedEdit repair-effect runs once on mount
    // (writes ?edit=e1) which percent-encodes the comma, so we match either
    // form rather than the literal pre-mount string.
    const loc = locationText(container);
    expect(loc).toMatch(/collapsed=[^&]*foo/);
    expect(loc).toMatch(/collapsed=[^&]*models/);
  });
});
