import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FileEditSummary } from '../src/api/types.js';
import RadioPanel from '../src/components/RadioPanel.js';

afterEach(() => {
  cleanup();
});

function baseEdit(overrides: Partial<FileEditSummary> = {}): FileEditSummary {
  return {
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
    triggeringUserMessage: 'Do things. Add the thing.',
    triggeringSentence: {
      index: 1,
      text: 'Add the thing.',
      startChar: 11,
      endChar: 25,
    },
    thinkingBlocks: ['Planning the edit.'],
    tMs: 134_000,
    ...overrides,
  };
}

describe('RadioPanel', () => {
  it('renders RADIO heading, prompt with highlight, thinking, and meta rows with full data', () => {
    const edit = baseEdit({ turnIndex: 2, tMs: 134_000, operation: 'MultiEdit' });
    const { container, getByText, getByTestId } = render(
      <RadioPanel fileEdit={edit} turnCount={5} />,
    );

    // RADIO label.
    expect(getByText('RADIO')).toBeTruthy();

    // PROMPT section with the highlight on the exact sentence text.
    expect(getByText('PROMPT')).toBeTruthy();
    expect(getByTestId('sentence-highlight').textContent).toBe('Add the thing.');

    // THINKING section — rendered italic.
    expect(getByText('THINKING')).toBeTruthy();
    const thinking = getByText('Planning the edit.');
    expect(thinking.tagName).toBe('P');
    expect(thinking.className).toContain('italic');

    // Meta rows: TOOL / TURN / T+ with formatted values.
    expect(getByText('TOOL')).toBeTruthy();
    expect(getByText('MultiEdit')).toBeTruthy();
    expect(getByText('TURN')).toBeTruthy();
    expect(getByText('3 / 5')).toBeTruthy();
    expect(getByText('T+')).toBeTruthy();
    expect(getByText('2m 14s')).toBeTruthy();

    // A separator sits between the thinking section and the meta stack.
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
  });

  it('renders the fallback note and no highlight when triggeringSentence is null', () => {
    const edit = baseEdit({ triggeringSentence: null });
    const { queryByTestId, getByText } = render(
      <RadioPanel fileEdit={edit} turnCount={1} />,
    );

    expect(queryByTestId('sentence-highlight')).toBeNull();
    expect(getByText('Do things. Add the thing.')).toBeTruthy();
    expect(getByText('(no sentence match — review full prompt)')).toBeTruthy();
  });

  it('renders "(no reasoning captured)" when thinkingBlocks is empty', () => {
    const edit = baseEdit({ thinkingBlocks: [] });
    const { getByText, container } = render(
      <RadioPanel fileEdit={edit} turnCount={1} />,
    );

    const fallback = getByText('(no reasoning captured)');
    expect(fallback.className).toContain('italic');

    // No stray <p> elements with thinking content above the fallback.
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(1);
  });

  it('renders multi-paragraph thinking as separate <p> elements, each italic', () => {
    const edit = baseEdit({
      thinkingBlocks: ['First consideration.', 'Second decision.'],
    });
    const { getByText, container } = render(
      <RadioPanel fileEdit={edit} turnCount={1} />,
    );

    // Find the THINKING section's <p> children — they're direct children of a
    // wrapper div that follows the THINKING label.
    const paras = container.querySelectorAll('p.italic');
    expect(paras.length).toBe(2);
    expect(getByText('First consideration.').tagName).toBe('P');
    expect(getByText('Second decision.').tagName).toBe('P');
    expect(getByText('First consideration.').className).toContain('italic');
    expect(getByText('Second decision.').className).toContain('italic');
  });

  it('renders only the RADIO heading when fileEdit is null', () => {
    const { getByText, queryByText, container } = render(
      <RadioPanel fileEdit={null} turnCount={0} />,
    );

    expect(getByText('RADIO')).toBeTruthy();
    expect(queryByText('PROMPT')).toBeNull();
    expect(queryByText('THINKING')).toBeNull();
    expect(queryByText('TOOL')).toBeNull();
    expect(queryByText('TURN')).toBeNull();
    expect(queryByText('T+')).toBeNull();
    expect(container.querySelector('[role="separator"]')).toBeNull();
  });

  it('skips the TURN row when turnCount is 0', () => {
    // Defensive guard: the test fixture in Session.test.tsx has turns: [], so
    // without this skip we would render "1 / 0" for real edits. Real sessions
    // always have ≥1 turn; this is a belt-and-suspenders check.
    const edit = baseEdit();
    const { getByText, queryByText } = render(
      <RadioPanel fileEdit={edit} turnCount={0} />,
    );

    expect(getByText('TOOL')).toBeTruthy();
    expect(getByText('T+')).toBeTruthy();
    expect(queryByText('TURN')).toBeNull();

    // Scoped sanity: the meta row value "1 / 0" is not rendered anywhere
    // under the Radio region.
    const panel = getByText('RADIO').closest('div')?.parentElement;
    expect(panel).not.toBeNull();
    expect(
      within(panel as HTMLElement).queryByText(/\/ 0/),
    ).toBeNull();
  });
});
