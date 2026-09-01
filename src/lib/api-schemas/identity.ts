import { z } from "zod";

export const identityAnalyzeSchema = z.object({
  url: z.string().min(1, "url required").trim(),
  companyName: z.string().trim().optional(),
  keyMessages: z.array(z.string()).optional(),
});
