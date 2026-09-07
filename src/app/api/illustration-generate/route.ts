import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateIllustration, type IllustrationSurface } from "@/lib/illustration-generator";

/** Converts a Sanity asset _ref to a CDN URL.
 *  ref format:  "image-{hash}-{W}x{H}-{ext}"
 *  CDN format:  "https://cdn.sanity.io/images/{projectId}/{dataset}/{hash}-{W}x{H}.{ext}"
 */
function refToCdnUrl(ref: string): string {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset   = process.env.SANITY_DATASET ?? "production";
  const filename  = ref.replace(/^image-/, "").replace(/-([^-]+)$/, ".$1");
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${filename}`;
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireUser();
  if (authError) return authError;

  let title: string, summary: string, surface: IllustrationSurface;
  try {
    ({ title, summary, surface } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!title || !surface || !["light", "dark"].includes(surface)) {
    return NextResponse.json(
      { error: 'title (string), summary (string), and surface ("light" | "dark") are required' },
      { status: 400 }
    );
  }

  const cleanSummary = (summary ?? "").trim() || title.trim();
  const imageRef = await generateIllustration(title.trim(), cleanSummary, surface, user.id);

  if (!imageRef) {
    return NextResponse.json(
      { error: "Failed to generate a valid illustration after 2 attempts." },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ref:    imageRef,
    cdnUrl: refToCdnUrl(imageRef.asset._ref),
  });
}
