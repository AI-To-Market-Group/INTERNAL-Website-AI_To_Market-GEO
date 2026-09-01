import { parseBody, ok, err } from "@/lib/api-response";
import { structuredDataInputSchema } from "@/lib/api-schemas/structured-data";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  generateJsonLdSchemas,
  computeGeoCoverage,
} from "@/lib/structured-data/generators";
import type { StructuredDataGeneratorResponse } from "@/types";

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "127.0.0.1";
}

export async function POST(req: Request) {
  try {
    // Rate limit: 50 requests/hour
    const ip = getClientIp(req);
    const rate = await checkRateLimit(ip, "structured-data/generate", 50);
    if (!rate.ok) {
      return err("Rate limit exceeded. Try again later.", 429, "RATE_LIMIT_EXCEEDED");
    }

    // Parse & validate
    const { data, error } = await parseBody(req, structuredDataInputSchema);
    if (error) return error;

    // Generate all requested JSON-LD schemas
    const schemas = generateJsonLdSchemas(data);

    // Compute overall GEO coverage score
    const { score, recommendations } = computeGeoCoverage(schemas);

    const response: StructuredDataGeneratorResponse = {
      schemas,
      geoCoverageScore: score,
      recommendations,
    };

    return ok(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return err(`Failed to generate structured data: ${msg}`, 500);
  }
}
