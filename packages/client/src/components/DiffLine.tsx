import type { ThemedToken } from 'shiki';
import type { LineOp } from '../lib/diff-chunks.js';

// Single diff row: left gutter (pre/post line numbers), sign column, code.
// Tokens come pre-highlighted from the parent DiffView so each line reuses
// the same Shiki pass. When highlighting is not yet ready (or failed), the
// parent passes `null` and we fall back to flat text.

interface DiffLineProps {
  readonly op: LineOp;
  readonly tokens: ThemedToken[] | null;
}

export default function DiffLine({ op, tokens }: DiffLineProps) {
  const sign = op.kind === 'add' ? '+' : op.kind === 'del' ? '−' : ' ';
  const preNum = op.kind === 'add' ? '' : String(op.preLine);
  const postNum = op.kind === 'del' ? '' : String(op.postLine);

  const rowClass = [
    'grid grid-cols-[3rem_3rem_1rem_1fr] items-start font-mono text-code leading-5',
    op.kind === 'add' ? 'bg-pw-diff-add-bg' : '',
    op.kind === 'del' ? 'bg-pw-diff-del-bg' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const signClass =
    op.kind === 'add'
      ? 'text-pw-diff-add'
      : op.kind === 'del'
      ? 'text-pw-diff-del'
      : 'text-pw-fg-ghost';

  return (
    <div className={rowClass} data-line-kind={op.kind}>
      <span className="pr-2 text-right text-pw-fg-ghost select-none">
        {preNum}
      </span>
      <span className="pr-2 text-right text-pw-fg-ghost select-none">
        {postNum}
      </span>
      <span className={`select-none text-center ${signClass}`}>{sign}</span>
      <code className="whitespace-pre pl-2 pr-4 text-pw-fg-primary">
        {tokens === null ? op.text : renderTokens(tokens)}
      </code>
    </div>
  );
}

function renderTokens(tokens: readonly ThemedToken[]) {
  return tokens.map((t, i) => {
    const style: Record<string, string> = {};
    if (t.color !== undefined) style.color = t.color;
    if (t.fontStyle !== undefined && t.fontStyle > 0) {
      // Shiki's FontStyle is a bit-flag enum: 1=Italic, 2=Bold, 4=Underline.
      if ((t.fontStyle & 1) !== 0) style.fontStyle = 'italic';
      if ((t.fontStyle & 2) !== 0) style.fontWeight = 'bold';
      if ((t.fontStyle & 4) !== 0) style.textDecoration = 'underline';
    }
    return (
      <span key={i} style={style}>
        {t.content}
      </span>
    );
  });
}
