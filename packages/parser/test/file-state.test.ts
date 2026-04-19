import { describe, it, expect } from 'vitest';
import {
  applyEdit,
  applyMultiEdit,
  applyWrite,
  seedFromReadResult,
  VirtualFileMap,
} from '../src/file-state.js';

describe('applyEdit', () => {
  it('applies a matching Edit and records correct pre/post content', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'const x = 1;\nconst y = 2;\n');
    const result = applyEdit(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      old_string: 'x = 1',
      new_string: 'x = 10',
    });
    expect(result.preContent).toBe('const x = 1;\nconst y = 2;\n');
    expect(result.postContent).toBe('const x = 10;\nconst y = 2;\n');
    expect(result.warnings).toEqual([]);
    expect(map.get('src/a.ts')).toBe('const x = 10;\nconst y = 2;\n');
  });

  it('rejects an Edit whose old_string is not found (edit_miss)', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'foo');
    const result = applyEdit(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      old_string: 'bar',
      new_string: 'baz',
    });
    expect(result.preContent).toBeNull();
    expect(result.postContent).toBe('');
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('edit_miss');
    expect(result.warnings[0]?.detail).toContain('old_string not found');
    expect(result.warnings[0]?.detail).toContain('src/a.ts');
    expect(map.get('src/a.ts')).toBe('foo');
  });

  it('replaces every occurrence when replace_all: true', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'a\na\na\n');
    const result = applyEdit(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      old_string: 'a',
      new_string: 'b',
      replace_all: true,
    });
    expect(result.postContent).toBe('b\nb\nb\n');
    expect(result.warnings).toEqual([]);
    expect(map.get('src/a.ts')).toBe('b\nb\nb\n');
  });
});

describe('applyMultiEdit', () => {
  it('applies all sub-edits in sequence when each old_string hits', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'alpha beta gamma');
    const result = applyMultiEdit(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      edits: [
        { old_string: 'alpha', new_string: 'A' },
        { old_string: 'beta', new_string: 'B' },
        { old_string: 'gamma', new_string: 'G' },
      ],
    });
    expect(result.preContent).toBe('alpha beta gamma');
    expect(result.postContent).toBe('A B G');
    expect(result.warnings).toEqual([]);
    expect(map.get('src/a.ts')).toBe('A B G');
  });

  it('rejects the whole MultiEdit and does not mutate the map on partial miss', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'alpha beta gamma');
    const result = applyMultiEdit(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      edits: [
        { old_string: 'alpha', new_string: 'A' },
        { old_string: 'MISSING', new_string: 'X' },
        { old_string: 'gamma', new_string: 'G' },
      ],
    });
    expect(result.preContent).toBeNull();
    expect(result.postContent).toBe('');
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('multi_edit_partial_miss');
    expect(result.warnings[0]?.detail).toContain('sub-edit 2 of 3');
    expect(result.warnings[0]?.detail).toContain('old_string not found');
    // Atomic: map content unchanged, not partially applied.
    expect(map.get('src/a.ts')).toBe('alpha beta gamma');
  });
});

describe('applyWrite', () => {
  it('treats a Write to a new path as preContent null (no LE warning)', () => {
    const map = new VirtualFileMap();
    const result = applyWrite(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      content: 'hello\nworld\n',
    });
    expect(result.preContent).toBeNull();
    expect(result.postContent).toBe('hello\nworld\n');
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(map.get('src/a.ts')).toBe('hello\nworld\n');
  });

  it('overwrites an existing path and records pre/post', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'old line 1\nold line 2\n');
    const result = applyWrite(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      content: 'new line 1\nnew line 2\n',
    });
    expect(result.preContent).toBe('old line 1\nold line 2\n');
    expect(result.postContent).toBe('new line 1\nnew line 2\n');
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(2);
    expect(result.warnings).toEqual([]);
    expect(map.get('src/a.ts')).toBe('new line 1\nnew line 2\n');
  });

  it('emits line_ending_mismatch when a Write flips the file line-ending style', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'alpha\r\nbeta\r\n');
    const result = applyWrite(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      content: 'alpha\nbeta\n',
    });
    expect(result.preContent).toBe('alpha\r\nbeta\r\n');
    expect(result.postContent).toBe('alpha\nbeta\n');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('line_ending_mismatch');
    expect(result.warnings[0]?.detail).toContain('CRLF');
    expect(result.warnings[0]?.detail).toContain('LF');
  });
});

describe('applyEdit — dual-emission', () => {
  it('emits edit_miss FIRST then line_ending_mismatch when LE swap would have matched', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'line1\r\nline2\r\nline3\r\n');
    const result = applyEdit(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      old_string: 'line1\nline2\n',
      new_string: 'replaced',
    });
    expect(result.preContent).toBeNull();
    expect(result.postContent).toBe('');
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    // Exact order locked: edit_miss first (primary observable),
    // line_ending_mismatch second (diagnostic cause).
    expect(result.warnings.map((w) => w.code)).toEqual([
      'edit_miss',
      'line_ending_mismatch',
    ]);
    expect(result.warnings[0]?.detail).toContain('old_string not found');
    expect(result.warnings[1]?.detail).toContain('CRLF');
    expect(result.warnings[1]?.detail).toContain('LF');
    // Map unchanged.
    expect(map.get('src/a.ts')).toBe('line1\r\nline2\r\nline3\r\n');
  });

  it('emits only edit_miss when LE styles agree but old_string is absent', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'line1\nline2\n');
    const result = applyEdit(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      old_string: 'missing\nhere\n',
      new_string: 'whatever',
    });
    expect(result.warnings.map((w) => w.code)).toEqual(['edit_miss']);
  });
});

describe('applyEdit — diff line counting', () => {
  it('reports exact additions and deletions from the line diff', () => {
    const map = new VirtualFileMap();
    map.set('src/a.ts', 'one\ntwo\nthree\nfour');
    // Replace "two\nthree" with "TWO\nTHREE\nINSERTED":
    // pre lines [one, two, three, four] → post lines [one, TWO, THREE, INSERTED, four]
    // LCS = [one, four] → 2. additions = 5 - 2 = 3. deletions = 4 - 2 = 2.
    const result = applyEdit(map, 'src/a.ts', {
      file_path: '/abs/src/a.ts',
      old_string: 'two\nthree',
      new_string: 'TWO\nTHREE\nINSERTED',
    });
    expect(result.additions).toBe(3);
    expect(result.deletions).toBe(2);
  });
});

describe('seedFromReadResult', () => {
  it('seeds the virtual map and strips the "    N→" line-number prefix', () => {
    const map = new VirtualFileMap();
    seedFromReadResult(map, 'foo.ts', '    1→hello\n    2→world');
    expect(map.get('foo.ts')).toBe('hello\nworld');
  });

  it('does not overwrite an existing virtual map entry', () => {
    const map = new VirtualFileMap();
    map.set('foo.ts', 'original');
    seedFromReadResult(map, 'foo.ts', '    1→new content');
    expect(map.get('foo.ts')).toBe('original');
  });

  it('handles array-form tool_result content (text blocks)', () => {
    const map = new VirtualFileMap();
    seedFromReadResult(map, 'foo.ts', [
      { type: 'text', text: '    1→hello\n    2→world' },
    ]);
    expect(map.get('foo.ts')).toBe('hello\nworld');
  });

  it('strips variable-width line-number gutters (double-digit, triple-digit)', () => {
    const map = new VirtualFileMap();
    seedFromReadResult(
      map,
      'foo.ts',
      '   9→nine\n  10→ten\n 100→hundred',
    );
    expect(map.get('foo.ts')).toBe('nine\nten\nhundred');
  });
});
