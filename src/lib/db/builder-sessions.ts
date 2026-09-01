/**
 * Supabase persistence for builder sessions.
 * User-scoped: every operation requires a userId (auth.users.id).
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  BuilderSessionInfo,
  OutlineSection,
  ArticleDraft,
  WordPressMetadata,
} from "@/types";

type DbRow = {
  id: string;
  user_id: string;
  opportunity_id: string | null;
  topic_title: string;
  outline: unknown;
  draft: unknown;
  wp_metadata: unknown;
  opportunity_context: unknown;
  current_step: number;
  sent_to_wordpress_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToSession(row: DbRow): BuilderSessionInfo {
  const opportunityId = row.opportunity_id ?? row.id;
  return {
    opportunityId,
    sessionId: opportunityId,
    topicTitle: row.topic_title,
    outline: (row.outline as OutlineSection[] | null) ?? undefined,
    draft: (row.draft as ArticleDraft | null) ?? undefined,
    wpMetadata: (row.wp_metadata as WordPressMetadata | null) ?? undefined,
    opportunityContext: (row.opportunity_context as BuilderSessionInfo["opportunityContext"] | null) ?? undefined,
    currentStep: (row.current_step as 1 | 2 | 3) ?? 1,
    sentToWordPressAt: row.sent_to_wordpress_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function dbGetAllSessions(
  userId: string
): Promise<BuilderSessionInfo[]> {
  const { data, error } = await supabaseAdmin
    .from("builder_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as DbRow[]).map(rowToSession);
}

export async function dbGetSession(
  userId: string,
  opportunityId: string
): Promise<BuilderSessionInfo | null> {
  const { data, error } = await supabaseAdmin
    .from("builder_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToSession(data as DbRow);
}

export async function dbCreateSession(
  userId: string,
  params: { opportunity_id?: string; topic_title: string; opportunity_context?: BuilderSessionInfo["opportunityContext"] }
): Promise<BuilderSessionInfo> {
  const id =
    params.opportunity_id ??
    `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("builder_sessions")
    .upsert(
      {
        user_id: userId,
        opportunity_id: id,
        topic_title: params.topic_title,
        opportunity_context: params.opportunity_context ?? null,
        current_step: 1,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,opportunity_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return rowToSession(data as DbRow);
}

export type SessionUpdates = {
  outline?: OutlineSection[];
  article?: ArticleDraft | null;
  metadataWordPress?: WordPressMetadata | null;
  currentStep?: 1 | 2 | 3;
  sentToWordPressAt?: string | null;
  opportunityContext?: BuilderSessionInfo["opportunityContext"];
};

export async function dbDeleteSession(
  userId: string,
  opportunityId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("builder_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("opportunity_id", opportunityId);

  if (error) throw error;
}

export async function dbUpdateSession(
  userId: string,
  opportunityId: string,
  updates: SessionUpdates
): Promise<BuilderSessionInfo | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.outline !== undefined) patch.outline = updates.outline;
  if (updates.article !== undefined) patch.draft = updates.article;
  if (updates.metadataWordPress !== undefined) patch.wp_metadata = updates.metadataWordPress;
  if (updates.currentStep !== undefined) patch.current_step = updates.currentStep;
  if (updates.sentToWordPressAt !== undefined) patch.sent_to_wordpress_at = updates.sentToWordPressAt;
  if (updates.opportunityContext !== undefined) patch.opportunity_context = updates.opportunityContext;

  const { data, error } = await supabaseAdmin
    .from("builder_sessions")
    .update(patch)
    .eq("user_id", userId)
    .eq("opportunity_id", opportunityId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToSession(data as DbRow);
}
