import { describe, expect, it } from 'vitest';
import type { Sector } from '../src/api/types.js';
import {
  parseCollapsed,
  parseView,
  serializeCollapsed,
} from '../src/hooks/useRailView.js';

describe('parseView', () => {
  it('returns timeline for null', () => {
    expect(parseView(null)).toBe('timeline');
  });
  it('returns timeline for empty string', () => {
    expect(parseView('')).toBe('timeline');
  });
  it('returns timeline for the literal "timeline"', () => {
    expect(parseView('timeline')).toBe('timeline');
  });
  it('returns sectors for the literal "sectors"', () => {
    expect(parseView('sectors')).toBe('sectors');
  });
  it('falls back to timeline for unknown values', () => {
    expect(parseView('garbage')).toBe('timeline');
  });
});

describe('parseCollapsed', () => {
  it('returns empty set for null', () => {
    expect(parseCollapsed(null).size).toBe(0);
  });
  it('returns empty set for empty string', () => {
    expect(parseCollapsed('').size).toBe(0);
  });
  it('parses a comma-separated list of valid sectors', () => {
    const out = parseCollapsed('tests,views');
    expect(Array.from(out).sort()).toEqual(['tests', 'views']);
  });
  it('silently ignores invalid sector names', () => {
    const out = parseCollapsed('foo,models,bar');
    expect(Array.from(out)).toEqual(['models']);
  });
  it('dedupes repeated values', () => {
    const out = parseCollapsed('models,models');
    expect(Array.from(out)).toEqual(['models']);
  });
  it('tolerates trailing commas / empty tokens', () => {
    const out = parseCollapsed('models,');
    expect(Array.from(out)).toEqual(['models']);
  });
  it('accepts every Sector value as valid', () => {
    const all: Sector[] = [
      'migrations',
      'models',
      'controllers',
      'views',
      'tests',
      'config',
      'tasks',
      'other',
    ];
    const out = parseCollapsed(all.join(','));
    expect(out.size).toBe(all.length);
    for (const s of all) expect(out.has(s)).toBe(true);
  });
});

describe('serializeCollapsed', () => {
  it('returns empty string for an empty set', () => {
    expect(serializeCollapsed(new Set())).toBe('');
  });
  it('serializes alphabetically regardless of insertion order', () => {
    expect(serializeCollapsed(new Set<Sector>(['views', 'tests']))).toBe(
      'tests,views',
    );
    expect(serializeCollapsed(new Set<Sector>(['tests', 'views']))).toBe(
      'tests,views',
    );
  });
  it('handles a single-element set', () => {
    expect(serializeCollapsed(new Set<Sector>(['models']))).toBe('models');
  });
  it('round-trips parse → serialize for canonical inputs', () => {
    const raw = 'models,tests,views';
    expect(serializeCollapsed(parseCollapsed(raw))).toBe(raw);
  });
});
