import { describe, it, expect } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSessionRecords,
  ParseError,
  SchemaError,
  type SessionRecord,
} from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, 'fixtures');

async function collect(
  gen: AsyncGenerator<SessionRecord, void, void>,
): Promise<SessionRecord[]> {
  const out: SessionRecord[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe('readSessionRecords', () => {
  it('reads a valid JSONL fixture and yields all records in order', async () => {
    const records = await collect(
      readSessionRecords(join(FIXTURES, 'valid-session.jsonl')),
    );
    expect(records).toHaveLength(5);
    expect(records.map((r) => r.type)).toEqual([
      'summary',
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
  });

  it('strips a UTF-8 BOM from the first line', async () => {
    const records = await collect(
      readSessionRecords(join(FIXTURES, 'with-bom.jsonl')),
    );
    expect(records).toHaveLength(2);
    expect(records[0]?.type).toBe('user');
    expect(records[1]?.type).toBe('assistant');
  });

  it('skips blank lines mid-file and trailing', async () => {
    const records = await collect(
      readSessionRecords(join(FIXTURES, 'trailing-blank.jsonl')),
    );
    expect(records).toHaveLength(3);
  });

  it('handles a single line larger than 1 MB without buffering the full file', async () => {
    const tmp = join(tmpdir(), `pitwall-parser-large-${Date.now()}.jsonl`);
    const big = 'x'.repeat(1_200_000);
    const record = {
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-04-18T10:00:00.000Z',
      sessionId: 's1',
      message: { role: 'user', content: big },
    };
    await writeFile(tmp, JSON.stringify(record) + '\n', 'utf8');
    try {
      const records = await collect(readSessionRecords(tmp));
      expect(records).toHaveLength(1);
      const r = records[0];
      expect(r?.type).toBe('user');
      const probe = r as unknown as { message: { content: unknown } };
      expect(typeof probe.message.content).toBe('string');
      expect((probe.message.content as string).length).toBe(1_200_000);
    } finally {
      await rm(tmp, { force: true });
    }
  });

  it('throws ParseError with the offending line number on malformed JSON', async () => {
    const filepath = join(FIXTURES, 'invalid-json.jsonl');
    let caught: unknown;
    try {
      await collect(readSessionRecords(filepath));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ParseError);
    const e = caught as ParseError;
    expect(e.lineNumber).toBe(2);
    expect(e.filepath).toBe(filepath);
    expect(e.cause).toBeInstanceOf(SyntaxError);
  });

  it('throws SchemaError when a known type is missing a required field', async () => {
    const filepath = join(FIXTURES, 'schema-violation.jsonl');
    let caught: unknown;
    try {
      await collect(readSessionRecords(filepath));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SchemaError);
    const e = caught as SchemaError;
    expect(e.lineNumber).toBe(2);
    expect(e.filepath).toBe(filepath);
    expect(e.issues.length).toBeGreaterThan(0);
    expect(e.issues.some((i) => i.path.includes('message'))).toBe(true);
  });
});
