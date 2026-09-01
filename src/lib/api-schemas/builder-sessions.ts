import { z } from "zod";

export const builderSessionCreateSchema = z.object({
  opportunity_id: z.string().optional(),
  topic_title: z.string().min(1, "topic_title required"),
  opportunity_context: z.object({
    theme: z.string().optional(),
    intents: z.array(z.string()).optional(),
    content_brief: z.string().optional(),
    justification_signals: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

const outlineBulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  proof: z.string().optional(),
}).passthrough();

const outlineSectionSchema = z.object({
  id: z.string(),
  headingLevel: z.enum(["H2", "H3"]).default("H2"),
  type: z.string().optional(),
  title: z.string(),
  content: z.string().optional(),
  bullets: z.array(outlineBulletSchema).default([]),
  seo: z.object({
    keywords: z.array(z.string()).optional(),
    faqQuestions: z.array(z.string()).optional(),
  }).optional(),
}).passthrough();

const articleDraftSchema = z.object({
  title: z.string(),
  blocks: z.array(z.any()).optional(),
}).passthrough();

const wpMetadataSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  focus_keyword: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
}).passthrough();

export const builderSessionUpdateSchema = z.object({
  outline: z.array(outlineSectionSchema).optional(),
  article: articleDraftSchema.nullable().optional(),
  metadataWordPress: wpMetadataSchema.nullable().optional(),
  currentStep: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  sentToWordPressAt: z.string().nullable().optional(),
});
