import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatRelativeTime,
  formatTPlus,
} from '../src/utils/relative-time.js';

// Fixed `now` anchors all relative tests. Without it the tests would either
// race wall-clock boundaries (a "5m ago" case run at the 59.9-second mark of
// a minute could flip to "6m ago") or require timer mocking. Injectable `now`
// is the whole point — exercise it.
const NOW = new Date('2026-04-19T12:00:00Z');

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function isoAgo(msAgo: number): string {
  return new Date(NOW.getTime() - msAgo).toISOString();
}

describe('formatRelativeTime', () => {
  it('returns "just now" under a minute', () => {
    expect(formatRelativeTime(isoAgo(30 * SECOND), NOW)).toBe('just now');
  });

  it('formats minutes', () => {
    expect(formatRelativeTime(isoAgo(5 * MINUTE), NOW)).toBe('5m ago');
  });

  it('formats hours', () => {
    expect(formatRelativeTime(isoAgo(3 * HOUR), NOW)).toBe('3h ago');
  });

  it('formats days', () => {
    expect(formatRelativeTime(isoAgo(2 * DAY), NOW)).toBe('2d ago');
  });

  it('formats weeks', () => {
    expect(formatRelativeTime(isoAgo(3 * WEEK), NOW)).toBe('3w ago');
  });

  it('formats months', () => {
    expect(formatRelativeTime(isoAgo(4 * MONTH), NOW)).toBe('4mo ago');
  });

  it('falls back to a locale date beyond a year', () => {
    const result = formatRelativeTime(isoAgo(YEAR + DAY), NOW);
    // Locale-dependent output — assert the shape is absolute (not relative)
    // and contains decimal digits in any Unicode script. `\d` only matches
    // ASCII 0-9, so a runtime locale that renders digits in Arabic-Indic,
    // Devanagari, etc. would fail a `\d` check even though the output is
    // correct. `\p{Nd}` is the locale-agnostic equivalent.
    expect(result).not.toMatch(/ ago$/);
    expect(result).not.toBe('just now');
    expect(result).toMatch(/\p{Nd}/u);
  });
});

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(45_000)).toBe('45s');
  });

  it('formats minutes with seconds', () => {
    expect(formatDuration(192_000)).toBe('3m 12s');
  });

  it('formats hours with minutes', () => {
    expect(formatDuration(4_800_000)).toBe('1h 20m');
  });
});

describe('formatTPlus', () => {
  it('formats zero as "0.0s"', () => {
    expect(formatTPlus(0)).toBe('0.0s');
  });

  it('keeps one decimal of precision under a minute', () => {
    expect(formatTPlus(1_500)).toBe('1.5s');
    expect(formatTPlus(42_350)).toBe('42.3s');
  });

  it('crosses the minute boundary cleanly', () => {
    expect(formatTPlus(59_999)).toBe('59.9s');
    expect(formatTPlus(60_000)).toBe('1m 0s');
  });

  it('formats multi-minute values as Nm Ns', () => {
    expect(formatTPlus(134_000)).toBe('2m 14s');
    expect(formatTPlus(3_900_300)).toBe('65m 0s');
  });

  it('returns "0.0s" for invalid input', () => {
    expect(formatTPlus(Number.NaN)).toBe('0.0s');
    expect(formatTPlus(-1)).toBe('0.0s');
    expect(formatTPlus(Number.POSITIVE_INFINITY)).toBe('0.0s');
  });
});
