import { describe, it, expect } from 'vitest';
import { tokenizeSentences } from '../src/index.js';

describe('tokenizeSentences', () => {
  it('returns [] for empty string', () => {
    expect(tokenizeSentences('')).toEqual([]);
  });

  it('returns [] for whitespace-only input', () => {
    expect(tokenizeSentences('   \n\n\t  ')).toEqual([]);
  });

  it('splits a single period-terminated sentence with correct offsets', () => {
    const s = tokenizeSentences('Hello world.');
    expect(s).toEqual([
      { index: 0, text: 'Hello world.', startChar: 0, endChar: 12 },
    ]);
  });

  it('splits on . ! and ?', () => {
    const s = tokenizeSentences('Hi. Bye! Why?');
    expect(s.map((x) => x.text)).toEqual(['Hi.', 'Bye!', 'Why?']);
  });

  it('does not split inside inline backtick code', () => {
    const s = tokenizeSentences('Check `a.b.c` now.');
    expect(s).toHaveLength(1);
    expect(s[0]?.text).toBe('Check `a.b.c` now.');
  });

  it('does not split inside a fenced ``` code block', () => {
    const input = 'Before.\n```\nlet x = 1.0;\nlet y = 2.\n```\nAfter.';
    const s = tokenizeSentences(input);
    expect(s.map((x) => x.text)).toEqual([
      'Before.',
      '```\nlet x = 1.0;\nlet y = 2.\n```\nAfter.',
    ]);
  });

  it('treats \\n\\n as a sentence boundary for unterminated sentences', () => {
    const s = tokenizeSentences('first\n\nsecond.');
    expect(s.map((x) => x.text)).toEqual(['first', 'second.']);
  });

  it('captures a trailing sentence without terminator', () => {
    const s = tokenizeSentences('Hello world');
    expect(s).toEqual([
      { index: 0, text: 'Hello world', startChar: 0, endChar: 11 },
    ]);
  });

  it('does not double-split on multi-terminator clusters (!!!, ?!)', () => {
    const s = tokenizeSentences('Wow!!! Really?!');
    expect(s.map((x) => x.text)).toEqual(['Wow!!!', 'Really?!']);
  });

  it('preserves char offsets so text.slice(startChar, endChar) round-trips', () => {
    const input = 'First sentence. Second one! Third?';
    const s = tokenizeSentences(input);
    for (const sent of s) {
      expect(input.slice(sent.startChar, sent.endChar)).toBe(sent.text);
    }
  });

  it('traps unterminated backticks as code through EOS (no splits inside)', () => {
    const s = tokenizeSentences('wanted to test `foo bar baz');
    expect(s).toHaveLength(1);
    expect(s[0]?.text).toBe('wanted to test `foo bar baz');
  });

  it('handles paths inside sentences without splitting at dots-before-letters', () => {
    const s = tokenizeSentences(
      'Now add a test in spec/greet_spec.rb. And update config/app.yml.',
    );
    expect(s.map((x) => x.text)).toEqual([
      'Now add a test in spec/greet_spec.rb.',
      'And update config/app.yml.',
    ]);
  });
});
