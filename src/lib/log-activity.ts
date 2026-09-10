import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ActivityPayload {
  userId: string;
  userEmail: string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget server-side activity logger. Never throws. */
export async function logActivity(p: ActivityPayload): Promise<void> {
  try {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: p.userId,
      user_email: p.userEmail,
      action: p.action,
      entity_type: p.entityType ?? null,
      entity_id: p.entityId ?? null,
      entity_title: p.entityTitle ?? null,
      metadata: p.metadata ?? null,
    });
  } catch {
    // never let logging break the main flow
  }
}
