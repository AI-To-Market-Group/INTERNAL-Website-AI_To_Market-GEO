import { z } from "zod";

export const articleBuilderChatSchema = z.object({
  message: z.string().min(1, "Message is required").transform((s) => s.trim()),
  opportunityId: z.string().optional(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  topicTitle: z.string().optional(),
  outlineSummary: z.string().optional(),
  draftSummary: z.string().optional(),
  outlineSections: z.array(
    z.object({ id: z.string(), title: z.string() })
  ).optional(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).optional(),
});

export const reviseSectionSchema = z.object({
  order: z.number().int().min(1),
  title: z.string().min(1),
  description: z.array(z.string()),
  change_request: z.string().optional(),
  language: z.string().optional(),
  sibling_sections: z.array(z.object({ title: z.string(), summary: z.string() })).optional(),
});

export const reviseSelectionSchema = z.object({
  selected_text: z.string().transform((s) => s.trim()).refine((s) => s.length > 0, "selected_text is required"),
  change_request: z.string().optional(),
  language: z.string().optional(),
  article_context: z.string().optional(),
});
