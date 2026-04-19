import type { Sentence } from './tokenizer.js';

// Scoring threshold: a sentence must accrue at least this many weighted
// points to be picked as the triggering sentence. Threshold 1 reserves
// `null` for sentences that share literally nothing with the edit — the
// Radio panel still shows the full prompt when the highlight is wrong,
// so false-positive cost is much lower than false-negative cost.
export const INTENT_THRESHOLD = 1;

// Per-source weights. A sentence token that matches multiple sources
// takes the max weight, not the sum — prevents a path token that also
// appears in the postContent snippet from double-counting.
export const INTENT_WEIGHTS = {
  path: 1,
  operation: 1,
  keyword: 1,
} as const;

// Grammatical function words only. Semantic verbs (fix, add, remove,
// update, rename, refactor) are signal, not noise — they routinely
// appear in both the prompt and the edit content.
export const INTENT_STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'a', 'an',
  'and', 'or', 'but',
  'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had',
  'do', 'does', 'did',
  'to', 'of', 'in', 'on', 'at', 'for', 'with',
  'this', 'that', 'it', 'its',
]);

// Matches runs of letters/digits that start with a letter. Deliberately
// excludes underscore so `greet_spec` tokenizes to ['greet', 'spec'].
const WORD_RE = /[A-Za-z][A-Za-z0-9]*/g;

function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const t = m[0].toLowerCase();
    if (t.length < 2) continue;
    if (INTENT_STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

function splitCamel(word: string): string[] {
  return word
    .split(/(?=[A-Z])/)
    .map((p) => p.toLowerCase())
    .filter((p) => p.length >= 2 && !INTENT_STOPWORDS.has(p));
}

function hasMixedCaseIdentifierShape(word: string): boolean {
  let upper = 0;
  let lower = 0;
  for (let i = 0; i < word.length; i++) {
    const code = word.charCodeAt(i);
    if (code >= 65 && code <= 90) upper++;
    else if (code >= 97 && code <= 122) lower++;
  }
  return upper >= 2 && lower >= 1;
}

// Pulls three classes of high-signal tokens from the scoring snippet:
//   1. Contents of quoted strings (single or double).
//   2. Mixed-case identifiers with ≥2 uppercase AND ≥1 lowercase letters
//      (VisitTag, HTTPServer, XMLParser, UserController). Single-capital
//      Pascal words (Now, Add, The) are rejected — they collide with
//      common sentence-starters.
//   3. word.word tokens (e.g. `foo.ts`, `module.exports`).
//
// v2 refinement (known limitation): an identifier like HTTPServer or
// XMLParser splits to [httpserver, server] / [xmlparser, parser]
// because splitCamel only yields runs that start with an uppercase and
// have length ≥ 2. Pure acronym-splitting into [http, server] /
// [xml, parser] requires runs-of-uppercase logic and is deliberately
// out of scope for v1 — the Radio panel degrades gracefully since the
// full-prompt view always renders.
function extractKeywords(snippet: string): string[] {
  const out = new Set<string>();

  for (const m of snippet.matchAll(/(?:"([^"]*)"|'([^']*)')/g)) {
    const inner = m[1] ?? m[2] ?? '';
    for (const tok of tokenize(inner)) out.add(tok);
  }

  for (const m of snippet.matchAll(WORD_RE)) {
    const w = m[0];
    if (!hasMixedCaseIdentifierShape(w)) continue;
    const lower = w.toLowerCase();
    if (lower.length >= 2 && !INTENT_STOPWORDS.has(lower)) out.add(lower);
    for (const piece of splitCamel(w)) out.add(piece);
  }

  for (const m of snippet.matchAll(/\b([A-Za-z0-9]+)\.([A-Za-z0-9]+)\b/g)) {
    for (const part of [m[1]!, m[2]!]) {
      const lower = part.toLowerCase();
      if (lower.length >= 2 && !INTENT_STOPWORDS.has(lower)) out.add(lower);
    }
  }

  return [...out];
}

function readNewString(input: unknown): string {
  if (
    typeof input === 'object' &&
    input !== null &&
    'new_string' in input &&
    typeof input.new_string === 'string'
  ) {
    return input.new_string;
  }
  return '';
}

function concatMultiEditNewStrings(input: unknown): string {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('edits' in input) ||
    !Array.isArray(input.edits)
  ) {
    return '';
  }
  const edits: unknown[] = input.edits;
  const parts: string[] = [];
  for (const sub of edits) {
    const ns = readNewString(sub);
    if (ns.length > 0) parts.push(ns);
  }
  return parts.join('\n');
}

// If the file-state engine rejected the edit (postContent === ''),
// fall through to the AI's intended content: new_string for Edit, the
// concatenation of every sub-edit's new_string for MultiEdit. Write
// never falls through — its postContent is literally the intent.
function deriveScoringSnippet(
  postContent: string,
  operation: 'Edit' | 'MultiEdit' | 'Write',
  toolUseInput: unknown,
): string {
  if (postContent.length > 0) return postContent.slice(0, 200);
  if (operation === 'Edit') return readNewString(toolUseInput).slice(0, 200);
  if (operation === 'MultiEdit') {
    return concatMultiEditNewStrings(toolUseInput).slice(0, 200);
  }
  return '';
}

export function pickTriggeringSentence(
  sentences: readonly Sentence[],
  path: string,
  operation: 'Edit' | 'MultiEdit' | 'Write',
  postContent: string,
  toolUseInput: unknown,
): Sentence | null {
  if (sentences.length === 0) return null;

  const pathTokens = new Set(tokenize(path));
  const opTokens = new Set(splitCamel(operation));
  const snippet = deriveScoringSnippet(postContent, operation, toolUseInput);
  const keywordTokens = new Set(extractKeywords(snippet));

  let bestScore = 0;
  let bestSentence: Sentence | null = null;

  for (const sentence of sentences) {
    const seen = new Set<string>();
    let score = 0;
    for (const tok of tokenize(sentence.text)) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      let contribution = 0;
      if (pathTokens.has(tok)) {
        contribution = Math.max(contribution, INTENT_WEIGHTS.path);
      }
      if (opTokens.has(tok)) {
        contribution = Math.max(contribution, INTENT_WEIGHTS.operation);
      }
      if (keywordTokens.has(tok)) {
        contribution = Math.max(contribution, INTENT_WEIGHTS.keyword);
      }
      score += contribution;
    }
    // Strict `>`: on ties, the earlier sentence keeps the lead.
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  if (bestScore < INTENT_THRESHOLD) return null;
  return bestSentence;
}
