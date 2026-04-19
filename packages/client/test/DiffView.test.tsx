import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  FileEditSummary,
  SessionFileResponse,
} from '../src/api/types.js';
import DiffView from '../src/components/DiffView.js';
import type { FileContentState } from '../src/hooks/useFileContent.js';
import {
  buildDiffSegments,
  findFirstAddedChunkId,
  type Segment,
} from '../src/lib/diff-chunks.js';
import { __resetShikiForTests } from '../src/lib/shiki.js';

beforeEach(() => {
  __resetShikiForTests();
});

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
    triggeringUserMessage: 'do things',
    triggeringSentence: null,
    thinkingBlocks: [],
    tMs: 0,
    ...overrides,
  };
}

interface HarnessArgs {
  readonly fileEdit?: FileEditSummary;
  readonly file?: SessionFileResponse;
  readonly state?: FileContentState;
  readonly segments?: Segment[];
  readonly initialSelected?: string | null;
}

function Harness({
  fileEdit = baseEdit(),
  file,
  state,
  segments,
  initialSelected,
}: HarnessArgs) {
  const contentState: FileContentState =
    state ??
    (file !== undefined
      ? { kind: 'ready', data: file }
      : { kind: 'loading' });

  const resolvedSegments =
    segments ??
    (file !== undefined
      ? buildDiffSegments(file.preContent, file.postContent, file.path)
      : []);

  const defaultChunk = findFirstAddedChunkId(resolvedSegments);
  const initial =
    initialSelected === undefined ? defaultChunk : initialSelected;

  // Useful for the "click chunk selection" test: the initial selection is
  // reflected up through this harness, and clicks flow into the local state
  // so the DiffView re-renders with the new highlighted chunk.
  const [selected, setSelected] = useTestSelection(initial);

  return (
    <DiffView
      fileEdit={fileEdit}
      orderIndex={0}
      pathLabel={fileEdit.path}
      contentState={contentState}
      segments={resolvedSegments}
      selectedChunkId={selected}
      onSelectChunk={setSelected}
    />
  );
}

function useTestSelection(
  initial: string | null,
): [string | null, (next: string) => void] {
  const [s, set] = useState<string | null>(initial);
  return [s, set];
}

describe('DiffView', () => {
  it('renders a Ruby diff with the header row and chunk rows', async () => {
    const file: SessionFileResponse = {
      editId: 'e1',
      path: 'app/models/user.rb',
      preContent: 'class User\nend\n',
      postContent: 'class User\n  def name\n    @name\n  end\nend\n',
      language: 'ruby',
    };
    const { container, getByText } = render(
      <Harness fileEdit={baseEdit({ additions: 3 })} file={file} />,
    );

    // Header: path and counts.
    expect(getByText('app/models/user.rb')).toBeTruthy();
    expect(getByText('+3')).toBeTruthy();

    // Three add rows — +1 shows, so at least one add-kind row renders.
    const addRows = container.querySelectorAll('[data-line-kind="add"]');
    expect(addRows.length).toBeGreaterThan(0);

    // The first added chunk is selected by default (has data-selected=true).
    await waitFor(() => {
      const selected = container.querySelector<HTMLButtonElement>(
        'button[data-chunk-id][data-selected="true"]',
      );
      expect(selected).not.toBeNull();
    });
  });

  it('expands a collapsed hunk when its toggle is clicked', () => {
    // 10 leading eq lines + one chunk → leading hunk collapses 7 of them.
    const leadLines = Array.from({ length: 10 }, (_, i) => `line_${i}`);
    const pre = leadLines.join('\n') + '\n';
    const post = leadLines.join('\n') + '\nNEW\n';
    const file: SessionFileResponse = {
      editId: 'e1',
      path: 'lib/noop.rb',
      preContent: pre,
      postContent: post,
      language: 'ruby',
    };
    const { container, getByTestId, queryByText } = render(
      <Harness fileEdit={baseEdit({ additions: 1 })} file={file} />,
    );

    // Before expansion: hidden lines are not in the DOM, but the toggle is.
    expect(queryByText('line_0')).toBeNull();
    const toggle = getByTestId('diff-hunk-toggle');
    expect(toggle).toBeTruthy();

    fireEvent.click(toggle);

    // After expansion: the toggle is replaced by the hidden eq rows.
    expect(container.querySelector('[data-testid="diff-hunk-toggle"]')).toBeNull();
    expect(queryByText('line_0')).not.toBeNull();
  });

  it('sets selectedChunkId when a chunk is clicked', () => {
    // Two separated chunks — after clicking the second, its button should
    // carry data-selected=true; the first should flip to false.
    const preLines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const pre = preLines.join('\n') + '\n';
    const post = ['A', ...preLines.slice(1, 9), 'Jx', 'j'].join('\n') + '\n';
    const file: SessionFileResponse = {
      editId: 'e1',
      path: 'lib/two.rb',
      preContent: pre,
      postContent: post,
      language: 'ruby',
    };

    const { container } = render(
      <Harness fileEdit={baseEdit({ additions: 2, deletions: 1 })} file={file} />,
    );

    const chunks = container.querySelectorAll<HTMLButtonElement>(
      'button[data-chunk-id]',
    );
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const first = chunks[0];
    const last = chunks[chunks.length - 1];
    if (!first || !last) throw new Error('expected two chunks');

    expect(first.getAttribute('data-selected')).toBe('true');

    fireEvent.click(last);

    const afterFirst = container.querySelector<HTMLButtonElement>(
      `button[data-chunk-id="${first.getAttribute('data-chunk-id')}"]`,
    );
    const afterLast = container.querySelector<HTMLButtonElement>(
      `button[data-chunk-id="${last.getAttribute('data-chunk-id')}"]`,
    );
    expect(afterFirst?.getAttribute('data-selected')).toBe('false');
    expect(afterLast?.getAttribute('data-selected')).toBe('true');
  });

  it('renders the empty-state note for a failed edit (preContent=null, postContent="")', () => {
    const file: SessionFileResponse = {
      editId: 'e1',
      path: 'app/missed.rb',
      preContent: null,
      postContent: '',
      language: 'ruby',
    };
    const { getByText } = render(
      <Harness fileEdit={baseEdit({ additions: 0 })} file={file} />,
    );

    expect(getByText('This edit produced no file change.')).toBeTruthy();
  });
});
