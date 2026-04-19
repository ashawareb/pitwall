import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiHttpError, ApiUnreachableError } from '../api/client.js';
import { getSessionDetail } from '../api/endpoints.js';
import type { FileEditSummary, SessionDetailResponse } from '../api/types.js';
import DiffView from '../components/DiffView.js';
import RadioPanel from '../components/RadioPanel.js';
import Scrubber, { type ScrubberMode } from '../components/Scrubber.js';
import SectorsView from '../components/SectorsView.js';
import SessionTitle from '../components/SessionTitle.js';
import Timeline from '../components/Timeline.js';
import { useFileContent } from '../hooks/useFileContent.js';
import { useRailView } from '../hooks/useRailView.js';
import { useReplayPosition } from '../hooks/useReplayPosition.js';
import { useSelectedChunk } from '../hooks/useSelectedChunk.js';
import { useSelectedEdit } from '../hooks/useSelectedEdit.js';
import ThreePanel from '../layout/ThreePanel.js';
import TopBar from '../layout/TopBar.js';
import {
  buildDiffSegments,
  findFirstAddedChunkId,
} from '../lib/diff-chunks.js';
import { useSessionParams } from './useSessionParams.js';

const META_CLASS = 'text-meta uppercase tracking-meta text-pw-fg-faint';

type FetchState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; data: T };

function findAutoSelectedEdit(
  fileEdits: FileEditSummary[],
  tMs: number,
): FileEditSummary | null {
  for (let i = fileEdits.length - 1; i >= 0; i--) {
    const edit = fileEdits[i];
    if (edit !== undefined && edit.tMs <= tMs) return edit;
  }
  return null;
}

function isPreFirstEdit(
  tMs: number | null,
  fileEdits: FileEditSummary[],
): boolean {
  if (tMs === null) return false;
  const first = fileEdits[0];
  if (first === undefined) return false;
  return tMs < first.tMs;
}

export default function Session() {
  const { projectHash, sessionId } = useSessionParams();
  const [state, setState] = useState<FetchState<SessionDetailResponse>>({
    kind: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getSessionDetail(projectHash, sessionId)
      .then((res) => {
        if (!cancelled) setState({ kind: 'ready', data: res });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [projectHash, sessionId]);

  return (
    <ThreePanel
      topBar={
        <TopBar
          left={<TopBarLeft state={state} projectHash={projectHash} sessionId={sessionId} />}
          right={<TopBarRight state={state} />}
        />
      }
      left={<LeftPanel state={state} sessionId={sessionId} />}
      middle={
        state.kind === 'ready' ? (
          <MiddlePanel
            projectHash={projectHash}
            sessionId={sessionId}
            fileEdits={state.data.fileEdits}
            durationMs={state.data.durationMs}
          />
        ) : (
          <div className={META_CLASS}>Diff</div>
        )
      }
      right={<RightPanel state={state} />}
    />
  );
}

function TopBarLeft({
  state,
  projectHash,
  sessionId,
}: {
  state: FetchState<SessionDetailResponse>;
  projectHash: string;
  sessionId: string;
}) {
  if (state.kind !== 'ready') {
    return (
      <span className="text-ui text-pw-fg-muted">
        {projectHash} / {sessionId}
      </span>
    );
  }
  return <SessionTitle session={state.data} />;
}

function TopBarRight({
  state,
}: {
  state: FetchState<SessionDetailResponse>;
}) {
  if (state.kind !== 'ready') {
    return <span className={META_CLASS}>Lap Replay</span>;
  }
  return (
    <ScrubberContainer
      durationMs={state.data.durationMs}
      fileEdits={state.data.fileEdits}
    />
  );
}

// ScrubberContainer owns the URL write for every scrubber interaction. On
// each seek it recomputes the auto-selected edit (last edit with tMs ≤
// newTMs) and writes `?tMs` + `?edit` in one setSearchParams call so the
// scrubber and the Timeline never rev independently.
//
// DEBT #9: when newTMs < firstEdit.tMs, the auto-selected edit is null and
// we delete `?edit`. useSelectedEdit (spec 10) then falls back to edit 01,
// so Timeline visually highlights edit 01 while Diff/Radio render the
// pre-first-edit empty state. Acceptable for v1; fix path is a tMs-aware
// useSelectedEdit. See docs/DEBT.md #9.
function ScrubberContainer({
  durationMs,
  fileEdits,
}: {
  durationMs: number;
  fileEdits: FileEditSummary[];
}) {
  const { tMs, setPosition, setLive } = useReplayPosition(durationMs);
  const editTMsList = useMemo(
    () => fileEdits.map((e) => e.tMs),
    [fileEdits],
  );

  const handleSeek = useCallback(
    (newTMs: number, mode: ScrubberMode) => {
      const auto = findAutoSelectedEdit(fileEdits, newTMs);
      const writeMode = mode === 'drag' ? 'replace' : 'push';
      setPosition(newTMs, {
        mode: writeMode,
        editId: auto?.id ?? null,
      });
    },
    [fileEdits, setPosition],
  );

  const handleLive = useCallback(() => {
    setLive({ mode: 'push' });
  }, [setLive]);

  return (
    <Scrubber
      tMs={tMs}
      durationMs={durationMs}
      editTMsList={editTMsList}
      onSeek={handleSeek}
      onLive={handleLive}
    />
  );
}

function MiddlePanel({
  projectHash,
  sessionId,
  fileEdits,
  durationMs,
}: {
  projectHash: string;
  sessionId: string;
  fileEdits: FileEditSummary[];
  durationMs: number;
}) {
  const { tMs } = useReplayPosition(durationMs);
  const preFirst = isPreFirstEdit(tMs, fileEdits);

  const { selectedId } = useSelectedEdit(fileEdits);
  const fileContent = useFileContent(
    projectHash,
    sessionId,
    preFirst ? null : selectedId,
  );

  const { segments, firstAddedChunkId } = useMemo(() => {
    if (fileContent.kind !== 'ready') {
      return { segments: [], firstAddedChunkId: null };
    }
    const { preContent, postContent, path } = fileContent.data;
    const segs = buildDiffSegments(preContent, postContent, path);
    return { segments: segs, firstAddedChunkId: findFirstAddedChunkId(segs) };
  }, [fileContent]);

  const { selectedChunkId, selectChunk } = useSelectedChunk(
    selectedId,
    firstAddedChunkId,
  );

  const selectedEdit = useMemo(
    () => fileEdits.find((e) => e.id === selectedId) ?? null,
    [fileEdits, selectedId],
  );

  // Pre-first-edit empty state: scrubber sits before the first recorded edit,
  // so the diff has nothing to show. See DEBT #9 re: the Timeline
  // highlight/diff mismatch in this window.
  if (preFirst) {
    return <EmptyDiffState />;
  }

  if (selectedEdit === null) {
    return <div className={META_CLASS}>Diff</div>;
  }

  const orderIndex = fileEdits.indexOf(selectedEdit);

  return (
    <DiffView
      fileEdit={selectedEdit}
      orderIndex={orderIndex}
      pathLabel={selectedEdit.path}
      contentState={fileContent}
      segments={segments}
      selectedChunkId={selectedChunkId}
      onSelectChunk={selectChunk}
    />
  );
}

function EmptyDiffState() {
  return (
    <div className="flex h-full flex-col gap-2">
      <span className={META_CLASS}>Diff</span>
      <p className="text-ui text-pw-fg-muted">
        Session just started — no edits yet.
      </p>
    </div>
  );
}

function LeftPanel({
  state,
  sessionId,
}: {
  state: FetchState<SessionDetailResponse>;
  sessionId: string;
}) {
  if (state.kind === 'loading') {
    return <Signage>Loading session…</Signage>;
  }
  if (state.kind === 'error') {
    return <Signage><ErrorText error={state.error} /></Signage>;
  }
  return (
    <ReadyLeftRail
      fileEdits={state.data.fileEdits}
      sessionId={sessionId}
    />
  );
}

function ReadyLeftRail({
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

function RightPanel({ state }: { state: FetchState<SessionDetailResponse> }) {
  if (state.kind !== 'ready') {
    return <RadioPanel fileEdit={null} turnCount={0} />;
  }
  return <RightPanelReady data={state.data} />;
}

function RightPanelReady({ data }: { data: SessionDetailResponse }) {
  const { tMs } = useReplayPosition(data.durationMs);
  const preFirst = isPreFirstEdit(tMs, data.fileEdits);

  const { selectedId } = useSelectedEdit(data.fileEdits);
  const selectedEdit =
    data.fileEdits.find((e) => e.id === selectedId) ?? null;
  // Pre-first-edit: blank the Radio panel the same way the diff does.
  // DEBT #9 describes the Timeline mismatch during this window.
  const fileEditForRadio = preFirst ? null : selectedEdit;
  return (
    <RadioPanel fileEdit={fileEditForRadio} turnCount={data.turns.length} />
  );
}

function Signage({ children }: { children: ReactNode }) {
  return <div className="text-ui text-pw-fg-muted">{children}</div>;
}

function ErrorText({ error }: { error: unknown }) {
  if (error instanceof ApiUnreachableError) {
    return (
      <p className="text-ui text-pw-error">
        Cannot reach Pitwall server. Start it with{' '}
        <InlineCode>pnpm -F @pitwall/server dev</InlineCode>, then refresh.
      </p>
    );
  }
  if (error instanceof ApiHttpError) {
    return (
      <p className="text-ui text-pw-error">
        Server error: {error.code} (HTTP {error.status}).
      </p>
    );
  }
  return <p className="text-ui text-pw-error">Server error: internal.</p>;
}

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-interactive bg-pw-bg-panel-hover px-1 font-mono text-pw-fg-primary">
      {children}
    </code>
  );
}
