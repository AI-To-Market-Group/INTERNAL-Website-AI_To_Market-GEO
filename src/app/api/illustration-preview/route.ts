import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateIllustrationSvg, type IllustrationSurface } from "@/lib/illustration-generator";

export async function POST(request: NextRequest) {
  const { error: authError } = await requireUser();
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

  const svg = await generateIllustrationSvg(title.trim(), (summary ?? "").trim(), surface);

  if (!svg) {
    return NextResponse.json(
      { error: "Failed to generate a valid SVG after 2 attempts. Both were rejected by colour validation." },
      { status: 422 }
    );
  }

  return NextResponse.json({ svg });
}
