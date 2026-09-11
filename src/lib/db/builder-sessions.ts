/**
 * Supabase persistence for builder sessions.
 * Org-scoped: all team members see all sessions. user_id is stored for
 * creator attribution but is NOT used as a read/update/delete filter.
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
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToSession(row: DbRow): BuilderSessionInfo {
  const opportunityId = row.opportunity_id ?? row.id;
  const ctx = (row.opportunity_context as BuilderSessionInfo["opportunityContext"] | null) ?? undefined;
  return {
    opportunityId,
    sessionId: opportunityId,
    topicTitle: row.topic_title,
    creatorEmail: ctx?.creatorEmail ?? undefined,
    outline: (row.outline as OutlineSection[] | null) ?? undefined,
    draft: (row.draft as ArticleDraft | null) ?? undefined,
    wpMetadata: (row.wp_metadata as WordPressMetadata | null) ?? undefined,
    opportunityContext: ctx,
    currentStep: (row.current_step as 1 | 2 | 3) ?? 1,
    sentToWordPressAt: row.sent_to_wordpress_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function dbGetAllSessions(
  _userId: string
): Promise<BuilderSessionInfo[]> {
  const { data, error } = await supabaseAdmin
    .from("builder_sessions")
    .select("*")
    .is("trashed_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as DbRow[]).map(rowToSession);
}

export async function dbGetTrashedSessions(
  _userId: string
): Promise<BuilderSessionInfo[]> {
  const { data, error } = await supabaseAdmin
    .from("builder_sessions")
    .select("*")
    .not("trashed_at", "is", null)
    .order("trashed_at", { ascending: false });

  if (error) throw error;
  return (data as DbRow[]).map(rowToSession);
}

export async function dbTrashSession(
  _userId: string,
  opportunityId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("builder_sessions")
    .update({ trashed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("opportunity_id", opportunityId);
  if (error) throw error;
}

export async function dbRestoreSession(
  _userId: string,
  opportunityId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("builder_sessions")
    .update({ trashed_at: null, updated_at: new Date().toISOString() })
    .eq("opportunity_id", opportunityId);
  if (error) throw error;
}

export async function dbGetSession(
  _userId: string,
  opportunityId: string
): Promise<BuilderSessionInfo | null> {
  const { data, error } = await supabaseAdmin
    .from("builder_sessions")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data.length) return null;
  return rowToSession(data[0] as DbRow);
}

export async function dbCreateSession(
  userId: string,
  params: { opportunity_id?: string; topic_title: string; opportunity_context?: BuilderSessionInfo["opportunityContext"]; creatorEmail?: string }
): Promise<BuilderSessionInfo> {
  const id =
    params.opportunity_id ??
    `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  const ctx = {
    ...(params.opportunity_context ?? {}),
    ...(params.creatorEmail ? { creatorEmail: params.creatorEmail } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("builder_sessions")
    .upsert(
      {
        user_id: userId,
        opportunity_id: id,
        topic_title: params.topic_title,
        opportunity_context: Object.keys(ctx).length ? ctx : null,
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
  _userId: string,
  opportunityId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("builder_sessions")
    .delete()
    .eq("opportunity_id", opportunityId);

  if (error) throw error;
}

export async function dbUpdateSession(
  _userId: string,
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
    .eq("opportunity_id", opportunityId)
    .select()
    .limit(1);

  if (error) throw error;
  if (!data.length) return null;
  return rowToSession(data[0] as DbRow);
}
