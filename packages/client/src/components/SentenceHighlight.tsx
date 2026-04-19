import type { Sentence } from '../api/types.js';

interface SentenceHighlightProps {
  text: string;
  sentence: Sentence | null;
}

// Three-slice render: text[0..start] / text[start..end] / text[end..]. Empty
// slices render empty spans — fine. Null sentence falls through to the full
// text plus a small fallback note; we deliberately do not tokenize locally
// since the parser already owns sentence boundaries (spec 04) and doing it
// twice would diverge.
export default function SentenceHighlight({
  text,
  sentence,
}: SentenceHighlightProps) {
  if (sentence === null) {
    return (
      <div className="flex flex-col gap-2">
        <div className="whitespace-pre-wrap text-ui text-pw-fg-primary">
          {text}
        </div>
        <p className="text-meta uppercase tracking-meta text-pw-fg-faint">
          (no sentence match — review full prompt)
        </p>
      </div>
    );
  }

  const before = text.slice(0, sentence.startChar);
  const highlighted = text.slice(sentence.startChar, sentence.endChar);
  const after = text.slice(sentence.endChar);

  return (
    <div className="whitespace-pre-wrap text-ui text-pw-fg-primary">
      <span>{before}</span>
      <span
        data-testid="sentence-highlight"
        className="bg-pw-accent-soft"
        style={{ boxShadow: 'inset 0 0 0 1px var(--pw-accent)' }}
      >
        {highlighted}
      </span>
      <span>{after}</span>
    </div>
  );
}
