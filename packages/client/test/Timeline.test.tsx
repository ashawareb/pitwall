import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { FileEditSummary } from '../src/api/types.js';
import Timeline from '../src/components/Timeline.js';

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

// LocationProbe renders the current URL (pathname+search) as plain text so
// assertions can inspect routing side-effects without reaching into router
// internals.
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

function renderTimeline({
  fileEdits,
  sessionId = 'sess-1',
  initialEntry = '/s/proj/sess-1',
}: RenderArgs) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/s/:projectHash/:sessionId"
          element={
            <>
              <Timeline fileEdits={fileEdits} sessionId={sessionId} />
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

describe('Timeline', () => {
  it('renders edits in order with counts and selects edit 01 by default', () => {
    const edits = [
      makeEdit({
        id: 'e1',
        orderIndex: 0,
        path: 'app/models/user.rb',
        sector: 'models',
        operation: 'Edit',
        additions: 14,
        deletions: 3,
      }),
      makeEdit({
        id: 'e2',
        orderIndex: 1,
        path: 'app/controllers/users_controller.rb',
        sector: 'controllers',
        operation: 'Write',
        additions: 42,
        deletions: 0,
      }),
      makeEdit({
        id: 'e3',
        orderIndex: 2,
        path: 'spec/models/user_spec.rb',
        sector: 'tests',
        operation: 'Edit',
        additions: 5,
        deletions: 1,
      }),
    ];
    const { container, getByText } = renderTimeline({ fileEdits: edits });

    const buttons = container.querySelectorAll('button[data-edit-id]');
    expect(buttons.length).toBe(3);
    expect(buttons[0]?.getAttribute('data-edit-id')).toBe('e1');
    expect(buttons[1]?.getAttribute('data-edit-id')).toBe('e2');
    expect(buttons[2]?.getAttribute('data-edit-id')).toBe('e3');

    // Order labels 01 02 03, zero-padded.
    expect(getByText('01')).toBeTruthy();
    expect(getByText('02')).toBeTruthy();
    expect(getByText('03')).toBeTruthy();

    // Basenames render (unique, so no disambiguation).
    expect(getByText('user.rb')).toBeTruthy();
    expect(getByText('users_controller.rb')).toBeTruthy();
    expect(getByText('user_spec.rb')).toBeTruthy();

    // Op + counts: deletions suppressed when zero.
    expect(getByText('Edit +14 −3')).toBeTruthy();
    expect(getByText('Write +42')).toBeTruthy();
    expect(getByText('Edit +5 −1')).toBeTruthy();

    // Default selection is edit 01.
    const selected = selectedButton(container);
    expect(selected?.getAttribute('data-edit-id')).toBe('e1');

    // RailToggle header: both buttons enabled; Timeline is the active view by
    // default. Spec 13 made SECTORS clickable; styling alone conveys which
    // view is active.
    expect(getByText('Timeline')).toBeTruthy();
    const sectorsBtn = getByText('Sectors') as HTMLButtonElement;
    expect(sectorsBtn.tagName).toBe('BUTTON');
    expect(sectorsBtn.disabled).toBe(false);
  });

  it('click selects a row, updates the URL, and changes visual selection', () => {
    const edits = [
      makeEdit({ id: 'e1', orderIndex: 0, path: 'a/file-one.rb' }),
      makeEdit({ id: 'e2', orderIndex: 1, path: 'a/file-two.rb' }),
    ];
    const { container, getByTestId } = renderTimeline({ fileEdits: edits });

    // Before click: e1 is selected.
    expect(selectedButton(container)?.getAttribute('data-edit-id')).toBe('e1');

    const second = container.querySelector<HTMLButtonElement>(
      'button[data-edit-id="e2"]',
    );
    expect(second).not.toBeNull();
    if (second) fireEvent.click(second);

    // After click: e2 is selected, URL reflects it, e1 no longer selected.
    expect(selectedButton(container)?.getAttribute('data-edit-id')).toBe('e2');
    expect(getByTestId('location').textContent).toBe('/s/proj/sess-1?edit=e2');
  });

  it('keyboard j/k wraps, Enter is a no-op, and typing in inputs is ignored', () => {
    const edits = [
      makeEdit({ id: 'e1', orderIndex: 0, path: 'a/one.rb' }),
      makeEdit({ id: 'e2', orderIndex: 1, path: 'a/two.rb' }),
      makeEdit({ id: 'e3', orderIndex: 2, path: 'a/three.rb' }),
    ];
    const { container } = render(
      <MemoryRouter initialEntries={['/s/proj/sess-1']}>
        <Routes>
          <Route
            path="/s/:projectHash/:sessionId"
            element={
              <>
                <Timeline fileEdits={edits} sessionId="sess-1" />
                <input data-testid="decoy-input" />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const selectedId = () =>
      selectedButton(container)?.getAttribute('data-edit-id');

    expect(selectedId()).toBe('e1');

    fireEvent.keyDown(document, { key: 'j' });
    expect(selectedId()).toBe('e2');

    fireEvent.keyDown(document, { key: 'j' });
    expect(selectedId()).toBe('e3');

    // Wrap forward: e3 + j → e1.
    fireEvent.keyDown(document, { key: 'j' });
    expect(selectedId()).toBe('e1');

    // Wrap backward: e1 + k → e3.
    fireEvent.keyDown(document, { key: 'k' });
    expect(selectedId()).toBe('e3');

    // Enter is an explicit no-op.
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(selectedId()).toBe('e3');

    // Keyboard is gated while a text input is focused.
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="decoy-input"]',
    );
    expect(input).not.toBeNull();
    if (input) {
      input.focus();
      fireEvent.keyDown(input, { key: 'j' });
      expect(selectedId()).toBe('e3');
      input.blur();
    }
  });

  it('disambiguates colliding basenames by shortest unique path suffix', () => {
    const edits = [
      makeEdit({ id: 'e1', orderIndex: 0, path: 'app/models/user_tag.rb' }),
      makeEdit({
        id: 'e2',
        orderIndex: 1,
        path: 'app/serializers/user_tag.rb',
      }),
      makeEdit({ id: 'e3', orderIndex: 2, path: 'app/models/user.rb' }),
    ];
    const { getByText, queryAllByText } = renderTimeline({ fileEdits: edits });

    // Colliding basenames expand to the parent-dir suffix.
    expect(getByText('models/user_tag.rb')).toBeTruthy();
    expect(getByText('serializers/user_tag.rb')).toBeTruthy();
    // Non-colliding basename stays bare.
    expect(getByText('user.rb')).toBeTruthy();
    // The bare 'user_tag.rb' label is never rendered for the colliding pair.
    expect(queryAllByText('user_tag.rb').length).toBe(0);
  });

  it('falls back to edit 01 and repairs the URL when ?edit points at an unknown id', async () => {
    const edits = [
      makeEdit({ id: 'e1', orderIndex: 0, path: 'a/one.rb' }),
      makeEdit({ id: 'e2', orderIndex: 1, path: 'a/two.rb' }),
    ];
    const { container, findByTestId } = renderTimeline({
      fileEdits: edits,
      initialEntry: '/s/proj/sess-1?edit=does-not-exist',
    });

    // Visual fallback to edit 01.
    expect(selectedButton(container)?.getAttribute('data-edit-id')).toBe('e1');

    // URL is silently repaired to match — the repair effect runs after mount.
    const loc = await findByTestId('location');
    expect(loc.textContent).toBe('/s/proj/sess-1?edit=e1');
  });
});
