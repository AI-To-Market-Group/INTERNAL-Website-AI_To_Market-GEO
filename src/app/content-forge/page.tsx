import InsightsClient from "@/app/content-forge/InsightsClient";
import { getAllInsights } from "@/lib/insights/content";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const items = await getAllInsights(user.id);

  return <InsightsClient items={items} />;
}
