import type { ReactNode } from 'react';
import type { FileEditSummary } from '../api/types.js';
import { formatTPlus } from '../utils/relative-time.js';
import MetaRow from './MetaRow.js';
import SentenceHighlight from './SentenceHighlight.js';

interface RadioPanelProps {
  fileEdit: FileEditSummary | null;
  turnCount: number;
}

// The right rail. All Radio data is already on the selected FileEditSummary —
// spec 07 inlines triggeringUserMessage, triggeringSentence, and
// thinkingBlocks on the session-detail payload, so we never fetch here.
//
// Null fileEdit renders just the RADIO heading, keeping the panel shell
// present during load and when the session has zero edits. Non-null renders
// the full prompt / thinking / separator / meta stack.
export default function RadioPanel({ fileEdit, turnCount }: RadioPanelProps) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <Heading />
      {fileEdit !== null ? (
        <RadioBody fileEdit={fileEdit} turnCount={turnCount} />
      ) : null}
    </div>
  );
}

function Heading() {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-[6px] w-[6px] rounded-full bg-pw-accent"
      />
      <span className="text-meta uppercase tracking-meta text-pw-fg-faint">
        RADIO
      </span>
    </div>
  );
}

function RadioBody({
  fileEdit,
  turnCount,
}: {
  fileEdit: FileEditSummary;
  turnCount: number;
}) {
  return (
    <>
      <Section arrow="↓" label="PROMPT">
        <SentenceHighlight
          text={fileEdit.triggeringUserMessage}
          sentence={fileEdit.triggeringSentence}
        />
      </Section>
      <Section arrow="↑" label="THINKING">
        <Thinking blocks={fileEdit.thinkingBlocks} />
      </Section>
      <div
        role="separator"
        aria-orientation="horizontal"
        className="h-[0.5px] bg-white/10"
      />
      <div className="flex flex-col gap-1">
        <MetaRow label="TOOL" value={fileEdit.operation} />
        {turnCount > 0 ? (
          <MetaRow
            label="TURN"
            value={`${fileEdit.turnIndex + 1} / ${turnCount}`}
          />
        ) : null}
        <MetaRow label="T+" value={formatTPlus(fileEdit.tMs)} />
      </div>
    </>
  );
}

function Section({
  arrow,
  label,
  children,
}: {
  arrow: '↓' | '↑';
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-ui text-pw-accent">{arrow}</span>
        <span className="text-meta uppercase tracking-meta text-pw-fg-faint">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Thinking({ blocks }: { blocks: string[] }) {
  if (blocks.length === 0) {
    return (
      <p className="text-ui italic text-pw-fg-faint">(no reasoning captured)</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => (
        <p
          key={i}
          className="whitespace-pre-wrap text-ui italic text-pw-fg-muted"
        >
          {block}
        </p>
      ))}
    </div>
  );
}
