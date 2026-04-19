import { useEffect, useMemo, useState } from 'react';
import type { Highlighter, ThemedToken } from 'shiki';
import type { FileEditSummary, SessionFileResponse } from '../api/types.js';
import type { LineOp, Segment } from '../lib/diff-chunks.js';
import {
  ensureHighlighter,
  highlightLines,
  normalizeLang,
} from '../lib/shiki.js';
import DiffHunk from './DiffHunk.js';
import DiffLine from './DiffLine.js';
import type { FileContentState } from '../hooks/useFileContent.js';

// The middle panel.
//
// - Header row: "NN · path/to/file.ext"  +A −D.
// - Body: walks segments top-to-bottom, rendering chunk / context / hunk.
// - Empty state: preContent===null && postContent==='' → "edit produced no
//   change" note (spec 11 Do-Not + deleted-files fallback).
// - Highlighting: Shiki loads lazily off the post-image; each diff row looks
//   up its tokens by postLine. Until it lands we render plain text — this is
//   the progressive-enhancement path (spec 11 clarification c / lock 6).

interface DiffViewProps {
  readonly fileEdit: FileEditSummary;
  readonly orderIndex: number;
  readonly pathLabel: string;
  readonly contentState: FileContentState;
  readonly segments: Segment[];
  readonly selectedChunkId: string | null;
  readonly onSelectChunk: (chunkId: string) => void;
}

export default function DiffView({
  fileEdit,
  orderIndex,
  pathLabel,
  contentState,
  segments,
  selectedChunkId,
  onSelectChunk,
}: DiffViewProps) {
  return (
    <div className="flex h-full flex-col gap-2">
      <DiffHeader
        orderIndex={orderIndex}
        pathLabel={pathLabel}
        additions={fileEdit.additions}
        deletions={fileEdit.deletions}
      />
      <div
        className="min-h-0 flex-1 overflow-auto rounded-panel bg-pw-bg-panel"
        data-testid="diff-body"
      >
        <DiffBody
          contentState={contentState}
          segments={segments}
          selectedChunkId={selectedChunkId}
          onSelectChunk={onSelectChunk}
        />
      </div>
    </div>
  );
}

function DiffHeader({
  orderIndex,
  pathLabel,
  additions,
  deletions,
}: {
  orderIndex: number;
  pathLabel: string;
  additions: number;
  deletions: number;
}) {
  const order = String(orderIndex + 1).padStart(2, '0');
  return (
    <div className="flex items-baseline justify-between px-2 text-ui text-pw-fg-muted">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-pw-fg-faint">{order}</span>
        <span className="text-pw-fg-faint">·</span>
        <span className="font-mono text-pw-fg-primary">{pathLabel}</span>
      </div>
      <div className="flex items-baseline gap-3 font-mono text-code">
        <span className="text-pw-diff-add">+{additions}</span>
        {deletions > 0 ? (
          <span className="text-pw-diff-del">−{deletions}</span>
        ) : null}
      </div>
    </div>
  );
}

function DiffBody({
  contentState,
  segments,
  selectedChunkId,
  onSelectChunk,
}: {
  contentState: FileContentState;
  segments: Segment[];
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string) => void;
}) {
  if (contentState.kind === 'loading') {
    return (
      <div className="p-4 text-ui text-pw-fg-muted">Loading diff…</div>
    );
  }
  if (contentState.kind === 'error') {
    return (
      <div className="p-4 text-ui text-pw-error">
        Could not load diff: {describeError(contentState.error)}.
      </div>
    );
  }
  const { preContent, postContent } = contentState.data;
  if (preContent === null && postContent === '') {
    return (
      <div className="p-4 text-ui text-pw-fg-muted">
        This edit produced no file change.
      </div>
    );
  }
  if (segments.length === 0) {
    return (
      <div className="p-4 text-ui text-pw-fg-muted">No textual changes.</div>
    );
  }
  return (
    <DiffSegments
      file={contentState.data}
      segments={segments}
      selectedChunkId={selectedChunkId}
      onSelectChunk={onSelectChunk}
    />
  );
}

function DiffSegments({
  file,
  segments,
  selectedChunkId,
  onSelectChunk,
}: {
  file: SessionFileResponse;
  segments: Segment[];
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string) => void;
}) {
  const tokens = useShikiTokens(file.postContent, file.language);
  const tokensByPostLine = useMemo(() => {
    if (tokens === null) return null;
    const m = new Map<number, ThemedToken[]>();
    tokens.forEach((lineTokens, idx) => {
      m.set(idx + 1, lineTokens);
    });
    return m;
  }, [tokens]);

  return (
    <div>
      {segments.map((segment, i) =>
        renderSegment(
          segment,
          i,
          file.path,
          tokensByPostLine,
          selectedChunkId,
          onSelectChunk,
        ),
      )}
    </div>
  );
}

function renderSegment(
  segment: Segment,
  index: number,
  filePath: string,
  tokensByPostLine: ReadonlyMap<number, ThemedToken[]> | null,
  selectedChunkId: string | null,
  onSelectChunk: (chunkId: string) => void,
) {
  if (segment.kind === 'context') {
    // Stable key: use the first line's post/pre line — keeps rows stable
    // across re-renders without leaking segment-index semantics.
    const first = segment.lines[0];
    const key = first
      ? `ctx:${first.kind === 'del' ? `pre${first.preLine}` : `post${first.postLine}`}`
      : `ctx:empty:${index}`;
    return (
      <div key={key}>
        {segment.lines.map((op) => (
          <DiffLine
            key={lineKey(op)}
            op={op}
            tokens={tokensFor(tokensByPostLine, op)}
          />
        ))}
      </div>
    );
  }
  if (segment.kind === 'hunk') {
    const first = segment.lines[0];
    const key = first
      ? `hunk:${filePath}:post${first.kind === 'del' ? first.preLine : first.postLine}`
      : `hunk:${filePath}:empty:${index}`;
    return (
      <DiffHunk
        key={key}
        hiddenCount={segment.hiddenCount}
        lines={segment.lines}
        tokensByPostLine={tokensByPostLine}
      />
    );
  }
  // chunk
  const isSelected = segment.id === selectedChunkId;
  return (
    <button
      type="button"
      key={segment.id}
      onClick={() => onSelectChunk(segment.id)}
      data-chunk-id={segment.id}
      data-selected={isSelected}
      aria-pressed={isSelected}
      className={[
        'block w-full text-left',
        isSelected ? 'shadow-[inset_0_0_0_1px_var(--pw-accent)]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {segment.lines.map((op) => (
        <DiffLine
          key={lineKey(op)}
          op={op}
          tokens={tokensFor(tokensByPostLine, op)}
        />
      ))}
    </button>
  );
}

function lineKey(op: LineOp): string {
  if (op.kind === 'eq') return `eq:${op.postLine}`;
  if (op.kind === 'add') return `add:${op.postLine}`;
  return `del:${op.preLine}`;
}

function tokensFor(
  map: ReadonlyMap<number, ThemedToken[]> | null,
  op: LineOp,
): ThemedToken[] | null {
  if (map === null) return null;
  if (op.kind === 'del') return null;
  return map.get(op.postLine) ?? null;
}

// Lazy-initializes Shiki, highlights the post-image when it lands, and
// re-runs whenever the file content or language changes. Returns null while
// loading or on init failure — the caller falls back to plain text.
function useShikiTokens(
  postContent: string,
  language: string,
): ThemedToken[][] | null {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureHighlighter().then((h) => {
      if (!cancelled) setHighlighter(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (highlighter === null) return null;
    return highlightLines(highlighter, postContent, normalizeLang(language));
  }, [highlighter, postContent, language]);
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'unknown error';
}
