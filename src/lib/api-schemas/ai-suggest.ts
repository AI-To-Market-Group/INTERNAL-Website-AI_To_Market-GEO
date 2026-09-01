import { z } from "zod";

export const aiSuggestSchema = z.object({
  selection: z.string().min(1, "Selected text is required").transform((s) => s.trim()),
  prompt: z.string().optional(),
});
