export interface Sentence {
  index: number;
  text: string;
  startChar: number;
  endChar: number;
}

// Deterministic sentence tokenizer. Hand-written per spec; no NLP library.
// Splits on '.', '!', '?' when followed by whitespace or end-of-string.
// Treats '\n\n' as a fallback boundary for unterminated sentences.
// Preserves markdown code runs intact: fenced (```) wins over inline (`)
// unless we are already in inline state. Unclosed backticks trap the remainder
// of the input in code-mode, which is the same failure mode as most renderers.
export function tokenizeSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let sentenceIndex = 0;

  let i = 0;
  while (i < text.length && isAsciiWhitespace(text[i]!)) i++;
  let sentenceStart = i;

  let inFenced = false;
  let inInline = false;

  const emit = (endChar: number): void => {
    let end = endChar;
    while (end > sentenceStart && isAsciiWhitespace(text[end - 1]!)) end--;
    if (end > sentenceStart) {
      sentences.push({
        index: sentenceIndex++,
        text: text.slice(sentenceStart, end),
        startChar: sentenceStart,
        endChar: end,
      });
    }
  };

  while (i < text.length) {
    if (!inInline && text.startsWith('```', i)) {
      inFenced = !inFenced;
      i += 3;
      continue;
    }

    if (!inFenced && text[i] === '`') {
      inInline = !inInline;
      i++;
      continue;
    }

    if (inFenced || inInline) {
      i++;
      continue;
    }

    const ch = text[i]!;

    if (ch === '.' || ch === '!' || ch === '?') {
      const next = text[i + 1];
      if (next === undefined || isAsciiWhitespace(next)) {
        const endChar = i + 1;
        emit(endChar);
        i = endChar;
        while (i < text.length && isAsciiWhitespace(text[i]!)) i++;
        sentenceStart = i;
        continue;
      }
    }

    if (ch === '\n' && text[i + 1] === '\n') {
      emit(i);
      i += 2;
      while (i < text.length && isAsciiWhitespace(text[i]!)) i++;
      sentenceStart = i;
      continue;
    }

    i++;
  }

  if (sentenceStart < text.length) {
    emit(text.length);
  }

  return sentences;
}

function isAsciiWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}
