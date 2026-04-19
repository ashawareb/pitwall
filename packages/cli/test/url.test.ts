import { describe, expect, it } from 'vitest';
import { buildUrl } from '../src/url.js';

const BASE = 'http://127.0.0.1:4317';
const HASH = '-Users-me-proj';
const SESSION = '01d0c2e4-aaaa-bbbb-cccc-123456789abc';

describe('buildUrl', () => {
  it('no flags → /p/<hash> (CWD project sessions)', () => {
    expect(buildUrl({ baseUrl: BASE, all: false, projectHash: HASH })).toBe(
      `${BASE}/p/${HASH}`,
    );
  });

  it('--all → / (picker root)', () => {
    expect(buildUrl({ baseUrl: BASE, all: true, projectHash: HASH })).toBe(
      `${BASE}/`,
    );
  });

  it('--session → /s/<hash>/<id>', () => {
    expect(
      buildUrl({
        baseUrl: BASE,
        all: false,
        session: SESSION,
        projectHash: HASH,
      }),
    ).toBe(`${BASE}/s/${HASH}/${SESSION}`);
  });

  it('--session wins over --all (precedence)', () => {
    expect(
      buildUrl({
        baseUrl: BASE,
        all: true,
        session: SESSION,
        projectHash: HASH,
      }),
    ).toBe(`${BASE}/s/${HASH}/${SESSION}`);
  });

  it('trailing slash on baseUrl is normalized', () => {
    expect(
      buildUrl({
        baseUrl: `${BASE}/`,
        all: false,
        projectHash: HASH,
      }),
    ).toBe(`${BASE}/p/${HASH}`);
  });
});
