import { describe, it, expect } from 'vitest';
import type { AssistantBlock } from '../src/session.js';
import { extractThinkingBefore } from '../src/thinking.js';

describe('extractThinkingBefore', () => {
  it('returns [] when no thinking blocks are present', () => {
    const blocks: AssistantBlock[] = [
      { type: 'text', text: 'hello' },
      { type: 'tool_use', toolCallId: 'tu1' },
    ];
    expect(extractThinkingBefore(blocks, 'tu1')).toEqual([]);
  });

  it('returns the single thinking block before a tool_use', () => {
    const blocks: AssistantBlock[] = [
      { type: 'thinking', text: 'I will proceed.' },
      { type: 'tool_use', toolCallId: 'tu1' },
    ];
    expect(extractThinkingBefore(blocks, 'tu1')).toEqual([
      'I will proceed.',
    ]);
  });

  it('returns multiple thinking blocks interleaved with text in order', () => {
    const blocks: AssistantBlock[] = [
      { type: 'thinking', text: 'first' },
      { type: 'text', text: 'intermediate chatter' },
      { type: 'thinking', text: 'second' },
      { type: 'text', text: 'more chatter' },
      { type: 'thinking', text: 'third' },
      { type: 'tool_use', toolCallId: 'tu1' },
    ];
    expect(extractThinkingBefore(blocks, 'tu1')).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('ignores thinking blocks that appear after the target tool_use', () => {
    const blocks: AssistantBlock[] = [
      { type: 'thinking', text: 'before' },
      { type: 'tool_use', toolCallId: 'tu1' },
      { type: 'thinking', text: 'after' },
    ];
    expect(extractThinkingBefore(blocks, 'tu1')).toEqual(['before']);
  });

  it('scopes thinking to the specific target when multiple tool_uses exist', () => {
    const blocks: AssistantBlock[] = [
      { type: 'thinking', text: 'for tu1' },
      { type: 'tool_use', toolCallId: 'tu1' },
      { type: 'thinking', text: 'before tu2' },
      { type: 'tool_use', toolCallId: 'tu2' },
      { type: 'thinking', text: 'before tu3' },
      { type: 'tool_use', toolCallId: 'tu3' },
    ];
    expect(extractThinkingBefore(blocks, 'tu1')).toEqual(['for tu1']);
    expect(extractThinkingBefore(blocks, 'tu2')).toEqual([
      'for tu1',
      'before tu2',
    ]);
    expect(extractThinkingBefore(blocks, 'tu3')).toEqual([
      'for tu1',
      'before tu2',
      'before tu3',
    ]);
  });

  it('returns [] when the target toolCallId is not in the blocks', () => {
    const blocks: AssistantBlock[] = [
      { type: 'thinking', text: 'orphan' },
      { type: 'tool_use', toolCallId: 'tu1' },
    ];
    expect(extractThinkingBefore(blocks, 'missing')).toEqual([]);
  });
});
