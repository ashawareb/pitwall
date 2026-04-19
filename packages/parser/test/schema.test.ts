import { describe, it, expect } from 'vitest';
import {
  parseSessionRecord,
  TextBlockSchema,
  ThinkingBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
  ContentBlockSchema,
  UserMessageRecordSchema,
  AssistantMessageRecordSchema,
  OtherRecordSchema,
} from '../src/index.js';

describe('content block schemas', () => {
  it('parses each known block type', () => {
    expect(
      TextBlockSchema.safeParse({ type: 'text', text: 'hi' }).success,
    ).toBe(true);
    expect(
      ThinkingBlockSchema.safeParse({ type: 'thinking', thinking: 'hmm' })
        .success,
    ).toBe(true);
    expect(
      ToolUseBlockSchema.safeParse({
        type: 'tool_use',
        id: 'tu1',
        name: 'Write',
        input: { file_path: '/x', content: 'y' },
      }).success,
    ).toBe(true);
    expect(
      ToolResultBlockSchema.safeParse({
        type: 'tool_result',
        tool_use_id: 'tu1',
        content: 'ok',
      }).success,
    ).toBe(true);
  });

  it('preserves unknown sibling keys via passthrough', () => {
    const result = TextBlockSchema.safeParse({
      type: 'text',
      text: 'hi',
      cache_control: { type: 'ephemeral' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data['cache_control']).toEqual({ type: 'ephemeral' });
    }
  });

  it('rejects unknown content block types in the discriminated union', () => {
    expect(ContentBlockSchema.safeParse({ type: 'text', text: 'a' }).success).toBe(
      true,
    );
    expect(ContentBlockSchema.safeParse({ type: 'unknown_block' }).success).toBe(
      false,
    );
  });
});

describe('top-level record schemas', () => {
  it('UserMessageRecordSchema accepts both string and array content', () => {
    expect(
      UserMessageRecordSchema.safeParse({
        type: 'user',
        uuid: 'u1',
        timestamp: 't',
        message: { role: 'user', content: 'hi' },
      }).success,
    ).toBe(true);
    expect(
      UserMessageRecordSchema.safeParse({
        type: 'user',
        uuid: 'u1',
        timestamp: 't',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'ok' }],
        },
      }).success,
    ).toBe(true);
  });

  it('AssistantMessageRecordSchema requires an array content', () => {
    expect(
      AssistantMessageRecordSchema.safeParse({
        type: 'assistant',
        uuid: 'a1',
        timestamp: 't',
        message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
      }).success,
    ).toBe(true);
  });

  it('OtherRecordSchema accepts any object with a string type', () => {
    expect(
      OtherRecordSchema.safeParse({ type: 'summary', summary: 'a session' })
        .success,
    ).toBe(true);
  });
});

describe('parseSessionRecord dispatch', () => {
  it('routes type=user strictly — malformed user record fails, does not fall through', () => {
    const result = parseSessionRecord({
      type: 'user',
      uuid: 'u1',
      timestamp: 't',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues.some((i) => i.path.includes('message'))).toBe(
        true,
      );
    }
  });

  it('routes type=assistant strictly — malformed assistant record fails', () => {
    const result = parseSessionRecord({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't',
      message: { role: 'assistant' },
    });
    expect(result.success).toBe(false);
  });

  it('routes unknown types to OtherRecordSchema (passthrough)', () => {
    const result = parseSessionRecord({
      type: 'file-history-snapshot',
      messageId: 'm1',
      snapshot: { foo: 'bar' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('file-history-snapshot');
      const data = result.data as Record<string, unknown>;
      expect(data['snapshot']).toEqual({ foo: 'bar' });
    }
  });

  it('rejects records missing a string `type`', () => {
    expect(parseSessionRecord({ no_type: true }).success).toBe(false);
    expect(parseSessionRecord({ type: 123 }).success).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(parseSessionRecord('not an object').success).toBe(false);
    expect(parseSessionRecord(null).success).toBe(false);
    expect(parseSessionRecord(42).success).toBe(false);
  });
});
