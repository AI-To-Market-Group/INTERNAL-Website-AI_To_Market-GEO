import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getSession } from "@/lib/builder-sessions-store";
import { ok, err } from "@/lib/api-response";
import { detectViolations, correctViolations } from "@/lib/brand-voice-checker";

type Params = { params: Promise<{ opportunityId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { opportunityId } = await params;
  const body = await req.json().catch(() => ({})) as { mode?: string };
  const mode = body.mode === "correct" ? "correct" : "check";

  const session = await getSession(user.id, opportunityId);
  if (!session?.draft?.blocks?.length) {
    return err("No draft found for this session.", 404);
  }

  // Check all block types — hyphens appear in headings as often as paragraphs
  const blocks = session.draft.blocks;
  const contents = blocks.map((b) => b.content);

  const checks = detectViolations(contents);
  const totalViolations = checks.reduce((sum, c) => sum + c.violations.length, 0);

  if (mode === "check") {
    return ok({ checks, totalViolations });
  }

  // "correct" mode — correct then return diff
  const corrections = await correctViolations(contents, checks);
  return ok({ checks, corrections, totalViolations });
}
