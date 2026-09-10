/**
 * Builder sessions store — backed by Supabase.
 * All operations are user-scoped (userId = auth.users.id).
 */

import type { BuilderSessionInfo, OutlineSection, ArticleDraft, WordPressMetadata } from "@/types";
import {
  dbGetAllSessions,
  dbGetTrashedSessions,
  dbGetSession,
  dbCreateSession,
  dbUpdateSession,
  dbDeleteSession,
  dbTrashSession,
  dbRestoreSession,
} from "@/lib/db";

export async function getAllSessions(userId: string): Promise<BuilderSessionInfo[]> {
  return dbGetAllSessions(userId);
}

export async function getSession(userId: string, opportunityId: string): Promise<BuilderSessionInfo | null> {
  return dbGetSession(userId, opportunityId);
}

export async function createSession(
  userId: string,
  params: { opportunity_id?: string; topic_title: string; opportunity_context?: BuilderSessionInfo["opportunityContext"]; creatorEmail?: string }
): Promise<BuilderSessionInfo> {
  return dbCreateSession(userId, params);
}

export async function deleteSession(userId: string, opportunityId: string): Promise<void> {
  return dbDeleteSession(userId, opportunityId);
}

export async function getTrashedSessions(userId: string): Promise<BuilderSessionInfo[]> {
  return dbGetTrashedSessions(userId);
}

export async function trashSession(userId: string, opportunityId: string): Promise<void> {
  return dbTrashSession(userId, opportunityId);
}

export async function restoreSession(userId: string, opportunityId: string): Promise<void> {
  return dbRestoreSession(userId, opportunityId);
}

export async function updateSession(
  userId: string,
  opportunityId: string,
  updates: {
    outline?: OutlineSection[];
    article?: ArticleDraft | null;
    metadataWordPress?: WordPressMetadata | null;
    currentStep?: 1 | 2 | 3;
    sentToWordPressAt?: string | null;
  }
): Promise<BuilderSessionInfo | null> {
  return dbUpdateSession(userId, opportunityId, updates);
}
