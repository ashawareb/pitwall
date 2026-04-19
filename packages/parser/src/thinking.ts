import type { AssistantBlock } from './session.js';

// Find the tool_use block with `toolCallId` and return every thinking
// block that appeared strictly before it, in order. Text blocks and
// other tool_use blocks are skipped but do not reset the scan. If the
// target tool_use is not in the list, returns [] rather than leaking
// unrelated thinking blocks.
export function extractThinkingBefore(
  blocks: readonly AssistantBlock[],
  toolCallId: string,
): string[] {
  const targetIdx = blocks.findIndex(
    (b) => b.type === 'tool_use' && b.toolCallId === toolCallId,
  );
  if (targetIdx < 0) return [];

  const out: string[] = [];
  for (let i = 0; i < targetIdx; i++) {
    const block = blocks[i]!;
    if (block.type === 'thinking') out.push(block.text);
  }
  return out;
}
