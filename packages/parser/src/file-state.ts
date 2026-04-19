import { countLineChanges } from './diff.js';

// File-state engine: replays Edit / MultiEdit / Write tool calls through a
// VirtualFileMap and returns the pre/post content and addition/deletion
// counts for each edit. Read tool-results seed the map so subsequent Edits
// can find their old_string in the parser's reconstructed state.

export type FileEditWarning =
  | { code: 'edit_miss'; detail: string }
  | { code: 'multi_edit_partial_miss'; detail: string }
  | { code: 'line_ending_mismatch'; detail: string };

export interface ApplyResult {
  preContent: string | null;
  postContent: string;
  additions: number;
  deletions: number;
  warnings: FileEditWarning[];
}

export class VirtualFileMap {
  private readonly files = new Map<string, string>();

  has(path: string): boolean {
    return this.files.has(path);
  }

  get(path: string): string | undefined {
    return this.files.get(path);
  }

  set(path: string, content: string): void {
    this.files.set(path, content);
  }

  // Seeds a path only if it is not already tracked. Used for Read-tool
  // results so a prior Write/Edit cannot be clobbered by a later re-Read.
  seed(path: string, content: string): void {
    if (!this.files.has(path)) this.files.set(path, content);
  }
}

type LineEnding = 'CRLF' | 'LF' | 'none';

function detectLE(s: string): LineEnding {
  if (s.includes('\r\n')) return 'CRLF';
  if (s.includes('\n')) return 'LF';
  return 'none';
}

function swapLE(s: string, target: 'CRLF' | 'LF'): string {
  return target === 'CRLF'
    ? s.replace(/(?<!\r)\n/g, '\r\n')
    : s.replace(/\r\n/g, '\n');
}

function readOldString(input: unknown): string | null {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('old_string' in input) ||
    typeof input.old_string !== 'string'
  ) {
    return null;
  }
  return input.old_string;
}

function readNewString(input: unknown): string | null {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('new_string' in input) ||
    typeof input.new_string !== 'string'
  ) {
    return null;
  }
  return input.new_string;
}

function readReplaceAll(input: unknown): boolean {
  return (
    typeof input === 'object' &&
    input !== null &&
    'replace_all' in input &&
    input.replace_all === true
  );
}

function readWriteContent(input: unknown): string | null {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('content' in input) ||
    typeof input.content !== 'string'
  ) {
    return null;
  }
  return input.content;
}

function applyOnce(
  source: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
): string {
  // Claude Code's Edit tool enforces that old_string is unique in the file
  // unless replace_all is true, so first-match semantics via String#replace
  // are correct and no uniqueness handling is needed here.
  return replaceAll
    ? source.split(oldString).join(newString)
    : source.replace(oldString, newString);
}

export function applyEdit(
  map: VirtualFileMap,
  relPath: string,
  input: unknown,
): ApplyResult {
  const oldString = readOldString(input);
  const newString = readNewString(input);
  if (oldString === null || newString === null) {
    return {
      preContent: null,
      postContent: '',
      additions: 0,
      deletions: 0,
      warnings: [
        {
          code: 'edit_miss',
          detail: `malformed Edit input for ${relPath}`,
        },
      ],
    };
  }

  const replaceAll = readReplaceAll(input);
  const current = map.get(relPath) ?? '';
  const fileLE = detectLE(current);
  const oldLE = detectLE(oldString);

  if (current.includes(oldString)) {
    const post = applyOnce(current, oldString, newString, replaceAll);
    map.set(relPath, post);
    const warnings: FileEditWarning[] = [];
    if (fileLE !== 'none' && oldLE !== 'none' && fileLE !== oldLE) {
      warnings.push({
        code: 'line_ending_mismatch',
        detail: `file uses ${fileLE}, old_string uses ${oldLE}`,
      });
    }
    const { additions, deletions } = countLineChanges(current, post);
    return {
      preContent: current,
      postContent: post,
      additions,
      deletions,
      warnings,
    };
  }

  // Literal miss. Order locked: edit_miss (primary observable) first,
  // line_ending_mismatch (diagnostic) second. The dual-emission test asserts
  // this exact order.
  const warnings: FileEditWarning[] = [
    { code: 'edit_miss', detail: `old_string not found in ${relPath}` },
  ];
  if (fileLE !== 'none' && oldLE !== 'none' && fileLE !== oldLE) {
    const swapped = swapLE(oldString, fileLE);
    if (swapped !== oldString && current.includes(swapped)) {
      warnings.push({
        code: 'line_ending_mismatch',
        detail: `file uses ${fileLE}, old_string uses ${oldLE}`,
      });
    }
  }
  return {
    preContent: null,
    postContent: '',
    additions: 0,
    deletions: 0,
    warnings,
  };
}

export function applyMultiEdit(
  map: VirtualFileMap,
  relPath: string,
  input: unknown,
): ApplyResult {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('edits' in input) ||
    !Array.isArray(input.edits)
  ) {
    return {
      preContent: null,
      postContent: '',
      additions: 0,
      deletions: 0,
      warnings: [
        {
          code: 'multi_edit_partial_miss',
          detail: `malformed MultiEdit input for ${relPath}: edits array missing`,
        },
      ],
    };
  }

  const edits: unknown[] = input.edits;
  const current = map.get(relPath) ?? '';
  let working = current;

  for (let i = 0; i < edits.length; i++) {
    const sub: unknown = edits[i];
    const oldString = readOldString(sub);
    const newString = readNewString(sub);
    if (oldString === null || newString === null) {
      return {
        preContent: null,
        postContent: '',
        additions: 0,
        deletions: 0,
        warnings: [
          {
            code: 'multi_edit_partial_miss',
            detail: `sub-edit ${i + 1} of ${edits.length}: malformed input`,
          },
        ],
      };
    }
    if (!working.includes(oldString)) {
      // MultiEdit is atomic: one miss rejects the whole edit. Virtual map
      // is not mutated (we operate on `working`, not the map, until the end).
      return {
        preContent: null,
        postContent: '',
        additions: 0,
        deletions: 0,
        warnings: [
          {
            code: 'multi_edit_partial_miss',
            detail: `sub-edit ${i + 1} of ${edits.length}: old_string not found`,
          },
        ],
      };
    }
    const replaceAll = readReplaceAll(sub);
    working = applyOnce(working, oldString, newString, replaceAll);
  }

  map.set(relPath, working);
  const { additions, deletions } = countLineChanges(current, working);
  return {
    preContent: current,
    postContent: working,
    additions,
    deletions,
    warnings: [],
  };
}

export function applyWrite(
  map: VirtualFileMap,
  relPath: string,
  input: unknown,
): ApplyResult {
  const content = readWriteContent(input);
  if (content === null) {
    // Malformed Write inputs are rare; surface silently with empty defaults
    // rather than inventing a warning code not covered by the data model.
    return {
      preContent: null,
      postContent: '',
      additions: 0,
      deletions: 0,
      warnings: [],
    };
  }

  const hadFile = map.has(relPath);
  const previous = hadFile ? (map.get(relPath) ?? '') : null;
  map.set(relPath, content);
  const { additions, deletions } = countLineChanges(previous ?? '', content);

  const warnings: FileEditWarning[] = [];
  // Write-specific LE semantic: a Write that silently flips a file's
  // line-ending style is worth flagging (dirty diffs downstream). New files
  // have no baseline to compare against, so the check only applies on
  // overwrite.
  if (previous !== null) {
    const preLE = detectLE(previous);
    const newLE = detectLE(content);
    if (preLE !== 'none' && newLE !== 'none' && preLE !== newLE) {
      warnings.push({
        code: 'line_ending_mismatch',
        detail: `file uses ${preLE}, new_string uses ${newLE}`,
      });
    }
  }

  return {
    preContent: previous,
    postContent: content,
    additions,
    deletions,
    warnings,
  };
}

// Claude Code's Read tool prepends a "    N→" line-number prefix to every
// line of file content in the tool_result. Strip it before seeding so
// subsequent Edit tool_uses against the same file can match old_string
// against the actual content. Format observed stable as of April 2026; if
// Claude Code changes the prefix, we will observe a surge of false-positive
// edit_miss warnings and fix this function.
const READ_PREFIX_RE = /^ *\d+→/;

export function stripReadPrefix(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(READ_PREFIX_RE, ''))
    .join('\n');
}

function extractReadText(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const items: unknown[] = content;
  const parts: string[] = [];
  for (const item of items) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'type' in item &&
      item.type === 'text' &&
      'text' in item &&
      typeof item.text === 'string'
    ) {
      parts.push(item.text);
    }
  }
  return parts.length > 0 ? parts.join('') : null;
}

export function seedFromReadResult(
  map: VirtualFileMap,
  relPath: string,
  rawResult: unknown,
): void {
  const text = extractReadText(rawResult);
  if (text === null) return;
  map.seed(relPath, stripReadPrefix(text));
}
