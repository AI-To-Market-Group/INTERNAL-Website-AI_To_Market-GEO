import { z } from "zod";

export const geoCompetitorInputSchema = z.object({
  name: z.string().min(1),
  url: z.string().optional(),
});

export const geoBrandEntitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["main", "brand", "sub_entity"]).optional(),
});

export const geoRunSchema = z.object({
  prompts: z.array(z.string().min(1)).min(1, "At least one prompt required"),
  mainUrl: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  brandEntities: z.array(geoBrandEntitySchema).optional(),
  vertical: z.string().optional(),
  mode: z.enum(["repeat", "variants"]).optional(),
  citationBranch: z.string().optional(),
  runsPerPrompt: z.number().int().min(1).max(10).optional(),
  variantsPerPrompt: z.number().int().min(1).max(5).optional(),
  competitors: z.array(geoCompetitorInputSchema).optional(),
  /** If true, use gpt-4o-mini-search-preview (web search, higher cost). If false, use gpt-4o-mini (knowledge only, cheaper). */
  useWebSearch: z.boolean().optional(),
  /** Which LLMs to test. Defaults to ["gpt"]. Perplexity requires PERPLEXITY_API_KEY, Claude requires ANTHROPIC_API_KEY. */
  targetLLMs: z.array(z.enum(["gpt", "perplexity", "claude"])).optional(),
});

export type GeoRunInput = z.infer<typeof geoRunSchema>;
