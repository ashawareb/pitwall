import { describe, it, expect } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reconstructSession,
  readSessionRecords,
  type AssistantMessageRecord,
  type SessionRecord,
  type UserMessageRecord,
} from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, 'fixtures');

async function* iter<T>(
  ...items: T[]
): AsyncGenerator<T, void, void> {
  for (const item of items) yield item;
}

describe('reconstructSession', () => {
  it('returns a valid empty Session for an empty iterable', async () => {
    const session = await reconstructSession(iter<SessionRecord>());
    expect(session.turns).toEqual([]);
    expect(session.fileEdits).toEqual([]);
    expect(session.id).toBe('');
    expect(session.projectHash).toBe('');
    expect(session.projectPath).toBe('');
    expect(session.firstPrompt).toBe('');
    expect(session.startedAt).toBe('');
    expect(session.endedAt).toBe('');
    expect(session.durationMs).toBe(0);
    expect(session.sectorSummary).toEqual({
      migrations: 0,
      models: 0,
      controllers: 0,
      views: 0,
      tests: 0,
      config: 0,
      tasks: 0,
      other: 0,
    });
  });

  it('builds a single-turn Session from a user + assistant text exchange', async () => {
    const records: SessionRecord[] = [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-04-18T10:00:00.000Z',
        sessionId: 's-single',
        cwd: '/tmp/demo',
        message: { role: 'user', content: 'Hi. How are you?' },
      } as UserMessageRecord,
      {
        type: 'assistant',
        uuid: 'a1',
        timestamp: '2026-04-18T10:00:01.000Z',
        sessionId: 's-single',
        cwd: '/tmp/demo',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Great.' }],
        },
      } as AssistantMessageRecord,
    ];
    const session = await reconstructSession(iter(...records));
    expect(session.id).toBe('s-single');
    expect(session.projectPath).toBe('/tmp/demo');
    expect(session.projectHash).toBe('-tmp-demo');
    expect(session.turns).toHaveLength(1);
    const turn = session.turns[0]!;
    expect(turn.index).toBe(0);
    expect(turn.userMessage.text).toBe('Hi. How are you?');
    expect(turn.userMessage.sentences.map((s) => s.text)).toEqual([
      'Hi.',
      'How are you?',
    ]);
    expect(turn.assistantBlocks).toEqual([{ type: 'text', text: 'Great.' }]);
    expect(turn.toolCalls).toEqual([]);
    expect(session.fileEdits).toEqual([]);
  });

  it('loads the multi-turn fixture into a full Session', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'multi-turn.jsonl')),
    );
    expect(session.id).toBe('s-mt');
    expect(session.projectPath).toBe('/tmp/demo');
    expect(session.projectHash).toBe('-tmp-demo');
    expect(session.turns).toHaveLength(2);

    const t0 = session.turns[0]!;
    expect(t0.toolCalls.map((c) => c.tool)).toEqual(['Write', 'Bash']);
    expect(t0.toolCalls[0]?.fileEditId).toBe('edit-tu1');
    expect(t0.toolCalls[1]?.fileEditId).toBeUndefined();

    const t1 = session.turns[1]!;
    expect(t1.toolCalls.map((c) => c.tool)).toEqual(['Edit', 'MultiEdit']);
    expect(t1.toolCalls[0]?.fileEditId).toBe('edit-tu3');
    expect(t1.toolCalls[1]?.fileEditId).toBe('edit-tu4');

    expect(session.fileEdits).toHaveLength(3);
    expect(session.fileEdits.map((e) => e.orderIndex)).toEqual([0, 1, 2]);
    expect(session.fileEdits.map((e) => e.turnIndex)).toEqual([0, 1, 1]);
    expect(session.fileEdits.map((e) => e.id)).toEqual([
      'edit-tu1',
      'edit-tu3',
      'edit-tu4',
    ]);
  });

  it('normalizes thinking blocks by renaming `thinking` to `text`', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'multi-turn.jsonl')),
    );
    const thinking = session.turns[0]!.assistantBlocks.find(
      (b) => b.type === 'thinking',
    );
    expect(thinking).toBeDefined();
    if (thinking && thinking.type === 'thinking') {
      expect(thinking.text).toBe('I will create the file.');
      expect(
        (thinking as unknown as Record<string, unknown>)['thinking'],
      ).toBeUndefined();
    }
  });

  it('matches tool_result blocks to ToolCall.result by tool_use_id', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'multi-turn.jsonl')),
    );
    const calls = session.turns.flatMap((t) => t.toolCalls);
    const byId = new Map(calls.map((c) => [c.id, c]));
    expect(byId.get('tu1')?.result).toBe('File created');
    expect(byId.get('tu2')?.result).toBe('OK');
    expect(byId.get('tu3')?.result).toBe('Edited');
    expect(byId.get('tu4')?.result).toBe('Updated');
  });

  it('emits FileEdits only for Edit / MultiEdit / Write (not Bash)', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'multi-turn.jsonl')),
    );
    expect(session.fileEdits.map((e) => e.operation)).toEqual([
      'Write',
      'Edit',
      'MultiEdit',
    ]);
    const bashCall = session.turns
      .flatMap((t) => t.toolCalls)
      .find((c) => c.tool === 'Bash');
    expect(bashCall?.fileEditId).toBeUndefined();
  });

  it('populates preContent / postContent / additions / deletions / warnings via the file-state engine', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'multi-turn.jsonl')),
    );
    const [writeEdit, editEdit, multiEdit] = session.fileEdits;
    // Write to a fresh path: preContent null, postContent is the new content.
    expect(writeEdit?.preContent).toBeNull();
    expect(writeEdit?.postContent).toBe(
      "export const greet = (n) => 'hi ' + n;\n",
    );
    expect(writeEdit?.additions).toBe(1);
    expect(writeEdit?.deletions).toBe(0);
    expect(writeEdit?.warnings).toEqual([]);
    // Edit against an un-seeded path: miss, whole edit rejected.
    expect(editEdit?.preContent).toBeNull();
    expect(editEdit?.postContent).toBe('');
    expect(editEdit?.additions).toBe(0);
    expect(editEdit?.deletions).toBe(0);
    expect(editEdit?.warnings.map((w) => w.code)).toEqual(['edit_miss']);
    // MultiEdit against an un-seeded path: miss on sub-edit 1, whole edit rejected.
    expect(multiEdit?.preContent).toBeNull();
    expect(multiEdit?.postContent).toBe('');
    expect(multiEdit?.additions).toBe(0);
    expect(multiEdit?.deletions).toBe(0);
    expect(multiEdit?.warnings.map((w) => w.code)).toEqual([
      'multi_edit_partial_miss',
    ]);
    expect(multiEdit?.warnings[0]?.detail).toContain('sub-edit 1 of 1');
  });

  it('populates Radio data (triggeringUserMessage, triggeringSentence, thinkingBlocks) from the parent turn', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'multi-turn.jsonl')),
    );
    const [writeEdit, editEdit, multiEdit] = session.fileEdits;
    // Turn 0 — path tokens {lib,greet,ts} win on sentence 2 of the prompt.
    expect(writeEdit?.triggeringUserMessage).toBe(
      'Please add a greet function. Put it in lib/greet.ts.',
    );
    expect(writeEdit?.triggeringSentence?.text).toBe('Put it in lib/greet.ts.');
    expect(writeEdit?.thinkingBlocks).toEqual(['I will create the file.']);
    // Turn 1 — first edit is a miss, but the new_string fallback keeps scoring
    // alive; path tokens {spec,greet,rb} lock sentence 1.
    expect(editEdit?.triggeringUserMessage).toBe(
      'Now add a test in spec/greet_spec.rb. And update config/app.yml.',
    );
    expect(editEdit?.triggeringSentence?.text).toBe(
      'Now add a test in spec/greet_spec.rb.',
    );
    expect(editEdit?.thinkingBlocks).toEqual([]);
    // Turn 1 — second edit: path tokens {config,app,yml} lock sentence 2.
    expect(multiEdit?.triggeringUserMessage).toBe(
      'Now add a test in spec/greet_spec.rb. And update config/app.yml.',
    );
    expect(multiEdit?.triggeringSentence?.text).toBe(
      'And update config/app.yml.',
    );
    expect(multiEdit?.thinkingBlocks).toEqual([]);
  });

  it('relativizes paths under projectPath and classifies sectors accordingly', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'multi-turn.jsonl')),
    );
    expect(
      session.fileEdits.map((e) => ({ path: e.path, sector: e.sector })),
    ).toEqual([
      { path: 'lib/greet.ts', sector: 'other' },
      { path: 'spec/greet_spec.rb', sector: 'tests' },
      { path: 'config/app.yml', sector: 'config' },
    ]);
    expect(session.sectorSummary).toEqual({
      migrations: 0,
      models: 0,
      controllers: 0,
      views: 0,
      tests: 1,
      config: 1,
      tasks: 0,
      other: 1,
    });
  });

  it('truncates firstPrompt at 200 chars with a trailing …', async () => {
    const long = 'x'.repeat(250);
    const records: SessionRecord[] = [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-04-18T10:00:00.000Z',
        sessionId: 's-long',
        cwd: '/',
        message: { role: 'user', content: long },
      } as UserMessageRecord,
    ];
    const session = await reconstructSession(iter(...records));
    expect(session.firstPrompt.length).toBe(201);
    expect(session.firstPrompt.endsWith('…')).toBe(true);
    expect(session.firstPrompt.slice(0, 200)).toBe('x'.repeat(200));
  });

  it('computes startedAt, endedAt, and durationMs from record timestamps', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'multi-turn.jsonl')),
    );
    expect(session.startedAt).toBe('2026-04-18T10:00:00.000Z');
    expect(session.endedAt).toBe('2026-04-18T10:00:13.000Z');
    expect(session.durationMs).toBe(13000);
  });

  it('silently skips orphan assistant blocks before any user turn', async () => {
    const session = await reconstructSession(
      readSessionRecords(join(FIXTURES, 'assistant-first.jsonl')),
    );
    expect(session.turns).toEqual([]);
    expect(session.fileEdits).toEqual([]);
    // Session metadata is still picked up from the orphan record.
    expect(session.id).toBe('s-af');
    expect(session.projectPath).toBe('/tmp/demo');
    expect(session.projectHash).toBe('-tmp-demo');
  });
});
