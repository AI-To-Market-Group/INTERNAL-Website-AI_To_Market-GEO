import { z } from "zod";

const insightCategorySchema = z.enum([
  "blog",
  "linkedin",
  "reddit",
  "wikipedia",
]);

export const insightsCreateSchema = z.object({
  title: z.string().min(1, "title required"),
  category: insightCategorySchema.optional(),
  markdown: z.string().optional(),
  parentSlug: z.string().optional(),
});

export const insightsSaveSchema = z.object({
  slug: z.string().min(1, "slug required").transform((s) =>
    s.replace(/[^a-zA-Z0-9_-]/g, "")
  ).refine((s) => s.length > 0, "Invalid slug"),
  markdown: z.string(),
});

export const insightsDeleteSchema = z.object({
  slug: z.string().min(1, "slug required").transform((s) =>
    s.replace(/[^a-zA-Z0-9_-]/g, "")
  ).refine((s) => s.length > 0, "Invalid slug"),
});

export const insightsUpdateTitleSchema = z.object({
  slug: z.string().min(1, "slug required").transform((s) =>
    s.replace(/[^a-zA-Z0-9_-]/g, "")
  ).refine((s) => s.length > 0, "Invalid slug"),
  title: z.string().min(1, "title required"),
});

export const insightsGenerateSchema = z.object({
  action: z.enum(["create", "generate-blogs", "generate-linkedin"]),
  category: insightCategorySchema.optional(),
  prompt: z.string().optional(),
  sourceSlug: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceMarkdown: z.string().optional(),
  count: z.number().int().min(1).max(3).optional(),
});
