import { z } from 'zod';

// Content blocks live inside `message.content` arrays. Field shapes mirror the
// Anthropic API; spec 02 will normalize these into Pitwall's AssistantBlock.

export const TextBlockSchema = z
  .object({
    type: z.literal('text'),
    text: z.string(),
  })
  .passthrough();

// Note: the API field is `thinking`, not `text`. Spec 02 renames this when it
// builds the normalized AssistantBlock.
export const ThinkingBlockSchema = z
  .object({
    type: z.literal('thinking'),
    thinking: z.string(),
    signature: z.string().optional(),
  })
  .passthrough();

export const ToolUseBlockSchema = z
  .object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  })
  .passthrough();

// `content` may be a string or an array of nested blocks; we keep it loose so
// the reader does not have to know every tool's result shape.
export const ToolResultBlockSchema = z
  .object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.unknown(),
    is_error: z.boolean().optional(),
  })
  .passthrough();

export const ContentBlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ThinkingBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
]);

// Common envelope fields Claude Code wraps around every record.
const recordEnvelope = {
  uuid: z.string(),
  timestamp: z.string(),
  parentUuid: z.string().nullable().optional(),
  sessionId: z.string().optional(),
  cwd: z.string().optional(),
} as const;

// `user` records carry either the human's typed string or an array of blocks
// (tool_result blocks ride on the next user turn from the API's perspective).
export const UserMessageRecordSchema = z
  .object({
    type: z.literal('user'),
    message: z
      .object({
        role: z.literal('user'),
        content: z.union([z.string(), z.array(ContentBlockSchema)]),
      })
      .passthrough(),
    ...recordEnvelope,
  })
  .passthrough();

export const AssistantMessageRecordSchema = z
  .object({
    type: z.literal('assistant'),
    message: z
      .object({
        role: z.literal('assistant'),
        content: z.array(ContentBlockSchema),
      })
      .passthrough(),
    ...recordEnvelope,
  })
  .passthrough();

// Catch-all for `summary`, `system`, `file-history-snapshot`, and any future
// top-level type. Strict on `type: string`, permissive on the rest. Spec 02
// may promote some of these to first-class schemas later.
export const OtherRecordSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ThinkingBlock = z.infer<typeof ThinkingBlockSchema>;
export type ToolUseBlock = z.infer<typeof ToolUseBlockSchema>;
export type ToolResultBlock = z.infer<typeof ToolResultBlockSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type UserMessageRecord = z.infer<typeof UserMessageRecordSchema>;
export type AssistantMessageRecord = z.infer<typeof AssistantMessageRecordSchema>;
export type OtherRecord = z.infer<typeof OtherRecordSchema>;
export type SessionRecord =
  | UserMessageRecord
  | AssistantMessageRecord
  | OtherRecord;

export type ParseSessionRecordResult =
  | { success: true; data: SessionRecord }
  | { success: false; error: z.ZodError };

// Dispatch on `type` first so a malformed known-type record (e.g. type: "user"
// with a missing `message`) cannot silently fall through to OtherRecordSchema.
// Only genuinely unknown types route to the catch-all.
const envelopeSchema = z.object({ type: z.string() }).passthrough();

export function parseSessionRecord(value: unknown): ParseSessionRecordResult {
  const envelope = envelopeSchema.safeParse(value);
  if (!envelope.success) {
    return { success: false, error: envelope.error };
  }

  switch (envelope.data.type) {
    case 'user': {
      const result = UserMessageRecordSchema.safeParse(value);
      return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
    }
    case 'assistant': {
      const result = AssistantMessageRecordSchema.safeParse(value);
      return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
    }
    default: {
      const result = OtherRecordSchema.safeParse(value);
      return result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error };
    }
  }
}
