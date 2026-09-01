"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBuilderSessions,
  getBuilderSession,
  postBuilderSession,
  patchBuilderSession,
} from "@/lib/api";
import { isMockEnvForced } from "@/lib/api";
import type { OutlineSection, ArticleDraft, WordPressMetadata, BuilderSessionInfo } from "@/types";

// Fallback localStorage functions (used if API fails or mock mode)
const STORAGE_SESSIONS = "builder_sessions_by_opportunity";

interface SessionInfo {
  opportunityId: string;
  sessionId: string;
  topicTitle: string;
  updatedAt: string;
  outline?: OutlineSection[];
  draft?: ArticleDraft | null;
  wpMetadata?: WordPressMetadata | null;
  currentStep?: 1 | 2 | 3;
  sentToWordPressAt?: string | null;
}

function loadSessionsFromLocalStorage(): Map<string, SessionInfo> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS);
    if (!raw) return new Map();
    const data = JSON.parse(raw) as Record<string, SessionInfo>;
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

function saveSessionsToLocalStorage(sessions: Map<string, SessionInfo>) {
  if (typeof window === "undefined") return;
  try {
    const obj = Object.fromEntries(sessions);
    localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(obj));
  } catch {}
}

// Convert BuilderSessionInfo to SessionInfo
function toSessionInfo(session: BuilderSessionInfo): SessionInfo {
  return {
    opportunityId: session.opportunityId,
    sessionId: session.sessionId,
    topicTitle: session.topicTitle,
    updatedAt: session.updatedAt,
    outline: session.outline,
    draft: session.draft,
    wpMetadata: session.wpMetadata,
    currentStep: session.currentStep,
    sentToWordPressAt: session.sentToWordPressAt,
  };
}

export function useBuilderSessions() {
  const queryClient = useQueryClient();
  const isMock = isMockEnvForced();

  // Query: Load all sessions
  const sessionsQuery = useQuery<BuilderSessionInfo[]>({
    queryKey: ["builder-sessions"],
    queryFn: async () => {
      if (isMock) {
        // Fallback to localStorage in mock mode
        const localSessions = loadSessionsFromLocalStorage();
        return Array.from(localSessions.values()).map((s) => ({
          opportunityId: s.opportunityId,
          sessionId: s.sessionId,
          topicTitle: s.topicTitle,
          updatedAt: s.updatedAt,
          createdAt: s.updatedAt, // Use updatedAt as createdAt fallback
          outline: s.outline,
          draft: s.draft,
          wpMetadata: s.wpMetadata,
          currentStep: s.currentStep,
        }));
      }

      try {
        return await getBuilderSessions();
      } catch (error) {
        console.warn("Failed to fetch builder sessions from API, using localStorage:", error);
        const localSessions = loadSessionsFromLocalStorage();
        return Array.from(localSessions.values()).map((s) => ({
          opportunityId: s.opportunityId,
          sessionId: s.sessionId,
          topicTitle: s.topicTitle,
          updatedAt: s.updatedAt,
          createdAt: s.updatedAt,
          outline: s.outline,
          draft: s.draft,
          wpMetadata: s.wpMetadata,
          currentStep: s.currentStep,
        }));
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Mutation: Create session
  const createSessionMutation = useMutation({
    mutationFn: async (params: { opportunityId?: string; topicTitle: string }) => {
      if (isMock) {
        // Fallback to localStorage
        const sessionId = params.opportunityId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newSession: SessionInfo = {
          opportunityId: sessionId,
          sessionId,
          topicTitle: params.topicTitle,
          updatedAt: new Date().toISOString(),
          currentStep: 1,
        };
        const localSessions = loadSessionsFromLocalStorage();
        localSessions.set(sessionId, newSession);
        saveSessionsToLocalStorage(localSessions);
        return toSessionInfo({
          opportunityId: sessionId,
          sessionId,
          topicTitle: params.topicTitle,
          updatedAt: newSession.updatedAt,
          createdAt: newSession.updatedAt,
          currentStep: 1,
        });
      }

      try {
        return await postBuilderSession({
          opportunity_id: params.opportunityId,
          topic_title: params.topicTitle,
        });
      } catch (error) {
        // 409 = session already exists — fetch and return it instead of creating
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("409") && params.opportunityId) {
          const existing = await getBuilderSession(params.opportunityId);
          if (existing && "found" in existing && existing.found) {
            return existing as BuilderSessionInfo;
          }
        }
        console.warn("Failed to create builder session via API, using localStorage:", error);
        // Fallback to localStorage for other errors
        const sessionId = params.opportunityId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newSession: SessionInfo = {
          opportunityId: sessionId,
          sessionId,
          topicTitle: params.topicTitle,
          updatedAt: new Date().toISOString(),
          currentStep: 1,
        };
        const localSessions = loadSessionsFromLocalStorage();
        localSessions.set(sessionId, newSession);
        saveSessionsToLocalStorage(localSessions);
        return toSessionInfo({
          opportunityId: sessionId,
          sessionId,
          topicTitle: params.topicTitle,
          updatedAt: newSession.updatedAt,
          createdAt: newSession.updatedAt,
          currentStep: 1,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["builder-sessions"] });
    },
  });

  // Mutation: Update session (with debounce handled by caller)
  const updateSessionMutation = useMutation({
    mutationFn: async (params: {
      opportunityId: string;
      updates: {
        outline?: OutlineSection[];
        draft?: ArticleDraft | null;
        wpMetadata?: WordPressMetadata | null;
        currentStep?: 1 | 2 | 3;
      };
    }) => {
      if (isMock) {
        // Fallback to localStorage
        const localSessions = loadSessionsFromLocalStorage();
        const existing = localSessions.get(params.opportunityId);
        if (existing) {
          const updated: SessionInfo = {
            ...existing,
            ...params.updates,
            updatedAt: new Date().toISOString(),
          };
          localSessions.set(params.opportunityId, updated);
          saveSessionsToLocalStorage(localSessions);
          return toSessionInfo({
            opportunityId: updated.opportunityId,
            sessionId: updated.sessionId,
            topicTitle: updated.topicTitle,
            updatedAt: updated.updatedAt,
            createdAt: updated.updatedAt,
            outline: updated.outline,
            draft: updated.draft,
            wpMetadata: updated.wpMetadata,
            currentStep: updated.currentStep,
          });
        }
        throw new Error("Session not found");
      }

      try {
        // Map frontend keys to API keys
        const apiUpdates: {
          outline?: OutlineSection[];
          article?: ArticleDraft | null;
          metadataWordPress?: WordPressMetadata | null;
          currentStep?: 1 | 2 | 3;
        } = {};
        if (params.updates.outline !== undefined) apiUpdates.outline = params.updates.outline;
        if (params.updates.draft !== undefined) apiUpdates.article = params.updates.draft;
        if (params.updates.wpMetadata !== undefined) apiUpdates.metadataWordPress = params.updates.wpMetadata;
        if (params.updates.currentStep !== undefined) apiUpdates.currentStep = params.updates.currentStep;

        return await patchBuilderSession(params.opportunityId, apiUpdates);
      } catch (error) {
        console.warn("Failed to update builder session via API, using localStorage:", error);
        // Fallback to localStorage
        const localSessions = loadSessionsFromLocalStorage();
        const existing = localSessions.get(params.opportunityId);
        if (existing) {
          const updated: SessionInfo = {
            ...existing,
            ...params.updates,
            updatedAt: new Date().toISOString(),
          };
          localSessions.set(params.opportunityId, updated);
          saveSessionsToLocalStorage(localSessions);
          return toSessionInfo({
            opportunityId: updated.opportunityId,
            sessionId: updated.sessionId,
            topicTitle: updated.topicTitle,
            updatedAt: updated.updatedAt,
            createdAt: updated.updatedAt,
            outline: updated.outline,
            draft: updated.draft,
            wpMetadata: updated.wpMetadata,
            currentStep: updated.currentStep,
          });
        }
        throw error;
      }
    },
    onSuccess: (updated) => {
      // Optimistic update: merge returned session into cache instead of refetch
      queryClient.setQueryData<BuilderSessionInfo[]>(["builder-sessions"], (prev) => {
        if (!prev) return prev;
        const id = updated.opportunityId;
        const idx = prev.findIndex((s) => s.opportunityId === id);
        const existing = idx >= 0 ? prev[idx] : undefined;
        const merged: BuilderSessionInfo = {
          ...existing,
          ...updated,
          opportunityId: updated.opportunityId,
          sessionId: updated.sessionId ?? updated.opportunityId,
          topicTitle: updated.topicTitle ?? "",
          updatedAt: updated.updatedAt ?? "",
          createdAt: "createdAt" in updated ? updated.createdAt : (existing?.createdAt ?? updated.updatedAt ?? ""),
        } as BuilderSessionInfo;
        const next = [...prev];
        if (idx >= 0) next[idx] = merged;
        else next.unshift(merged);
        return next.sort((a, b) =>
          (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
        );
      });
    },
  });

  // Create a Map from sessions array for easy lookup
  const sessionsMap = useMemo(() => {
    const map = new Map<string, SessionInfo>();
    if (sessionsQuery.data) {
      for (const session of sessionsQuery.data) {
        map.set(session.opportunityId, toSessionInfo(session));
      }
    }
    return map;
  }, [sessionsQuery.data]);

  const getSessionForOpportunity = useCallback(
    (opportunityId: string): SessionInfo | null => {
      return sessionsMap.get(opportunityId) ?? null;
    },
    [sessionsMap]
  );

  const hasSession = useCallback(
    (opportunityId: string): boolean => {
      return sessionsMap.has(opportunityId);
    },
    [sessionsMap]
  );

  const hasSessionWithOutline = useCallback(
    (opportunityId: string): boolean => {
      const session = sessionsMap.get(opportunityId);
      return session?.outline !== undefined && (session.outline?.length ?? 0) > 0;
    },
    [sessionsMap]
  );

  const hasSentToWordPress = useCallback(
    (opportunityId: string): boolean => {
      const session = sessionsMap.get(opportunityId);
      return Boolean(session?.sentToWordPressAt);
    },
    [sessionsMap]
  );

  const registerSession = useCallback(
    async (opportunityId: string, sessionId: string, topicTitle: string) => {
      await createSessionMutation.mutateAsync({
        opportunityId,
        topicTitle,
      });
    },
    [createSessionMutation]
  );

  const updateSession = useCallback(
    async (
      opportunityId: string,
      updates: {
        outline?: OutlineSection[];
        draft?: ArticleDraft | null;
        wpMetadata?: WordPressMetadata | null;
        currentStep?: 1 | 2 | 3;
      }
    ) => {
      await updateSessionMutation.mutateAsync({
        opportunityId,
        updates,
      });
    },
    [updateSessionMutation]
  );

  const getAllOpportunityIdsWithSessions = useCallback((): string[] => {
    return Array.from(sessionsMap.keys());
  }, [sessionsMap]);

  const deleteSessionMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      if (isMock) {
        const localSessions = loadSessionsFromLocalStorage();
        localSessions.delete(opportunityId);
        saveSessionsToLocalStorage(localSessions);
        return;
      }
      await fetch(`/api/builder-sessions/${opportunityId}`, { method: "DELETE" });
    },
    onSuccess: (_data, opportunityId) => {
      queryClient.setQueryData<BuilderSessionInfo[]>(["builder-sessions"], (prev) =>
        prev ? prev.filter((s) => s.opportunityId !== opportunityId) : prev
      );
    },
  });

  const deleteSession = useCallback(
    (opportunityId: string) => deleteSessionMutation.mutate(opportunityId),
    [deleteSessionMutation]
  );

  return {
    sessions: sessionsQuery.data ?? [],
    getSessionForOpportunity,
    hasSession,
    hasSessionWithOutline,
    hasSentToWordPress,
    registerSession,
    updateSession,
    deleteSession,
    getAllOpportunityIdsWithSessions,
    isLoading: sessionsQuery.isLoading,
    isCreating: createSessionMutation.isPending,
    isUpdating: updateSessionMutation.isPending,
  };
}
