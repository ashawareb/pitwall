import { describe, expect, it } from 'vitest';
import { detectLanguage } from '../src/lang.js';

describe('detectLanguage', () => {
  it('maps every documented extension to the documented language', () => {
    const cases: Array<[string, string]> = [
      ['a.rb', 'ruby'],
      ['a.ts', 'typescript'],
      ['a.tsx', 'typescript'],
      ['a.js', 'javascript'],
      ['a.jsx', 'javascript'],
      ['a.py', 'python'],
      ['a.sql', 'sql'],
      ['a.yml', 'yaml'],
      ['a.yaml', 'yaml'],
      ['a.json', 'json'],
      ['a.md', 'markdown'],
      ['a.html', 'html'],
      ['a.css', 'css'],
    ];
    for (const [path, lang] of cases) {
      expect(detectLanguage(path)).toBe(lang);
    }
  });

  it('falls back to text for unknown extensions', () => {
    expect(detectLanguage('a.xyz')).toBe('text');
    expect(detectLanguage('a.go')).toBe('text');
  });

  it('returns text for files without an extension', () => {
    expect(detectLanguage('Makefile')).toBe('text');
    expect(detectLanguage('/usr/local/bin/pitwall')).toBe('text');
  });

  it('returns text for a trailing dot with no extension', () => {
    expect(detectLanguage('archive.')).toBe('text');
  });

  it('matches extensions case-insensitively', () => {
    expect(detectLanguage('README.MD')).toBe('markdown');
    expect(detectLanguage('App.TSX')).toBe('typescript');
  });

  it('uses the last dot when the path has multiple dots', () => {
    expect(detectLanguage('app.test.ts')).toBe('typescript');
    expect(detectLanguage('schema.json.bak')).toBe('text');
  });
});
