import { describe, expect, it } from 'vitest';
import { formatBanner } from '../src/banner.js';

describe('formatBanner', () => {
  const params = {
    version: '0.1.0',
    cwd: '/Users/me/code/app',
    url: 'http://localhost:4317',
  };

  it('includes version, cwd, and url', () => {
    const out = formatBanner(params);
    expect(out).toContain('PITWALL  0.1.0');
    expect(out).toContain('/Users/me/code/app');
    expect(out).toContain('http://localhost:4317');
    expect(out).toContain('Ctrl-C');
  });

  it('matches the spec layout line-for-line', () => {
    expect(formatBanner(params)).toBe(
      [
        '   ███  PITWALL  0.1.0',
        '   ─────────────────────────────',
        '   Reviewing: /Users/me/code/app',
        '   URL:       http://localhost:4317',
        '   Quit:      Ctrl-C',
        '',
      ].join('\n'),
    );
  });
});
