import { requireUser } from "@/lib/api-auth";
import { ok, err } from "@/lib/api-response";
import {
  getOpportunitiesForUser,
  seedOpportunitiesForUser,
} from "@/lib/opportunities/db";
import { getMockOpportunities } from "@/lib/mock-dashboard-data";
import { normalizeOpportunities } from "@/lib/opportunity";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  let opps = await getOpportunitiesForUser(user.id);

  // First-time user: seed from mock data so the dashboard isn't empty
  if (opps.length === 0) {
    const mock = getMockOpportunities();
    await seedOpportunitiesForUser(user.id, mock);
    opps = mock;
  }

  const normalized = normalizeOpportunities(opps);

  return ok({
    meta: {
      total_opportunities: normalized.length,
      last_updated: new Date().toISOString(),
    },
    data: normalized,
  });
}
