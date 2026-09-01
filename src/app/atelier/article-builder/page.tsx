"use client";

import { Suspense, useEffect, useCallback, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrganicLoader } from "@/components/ui/organic-loader";
import { ArticleBuilderShell } from "@/components/article-builder/ArticleBuilderShell";
import { ContentGenerationChat } from "@/components/article-builder/ContentGenerationChat";
import { OutlineSectionList } from "@/components/article-builder/outline/OutlineSectionList";
import { StickyActionBar } from "@/components/article-builder/outline/StickyActionBar";
import { RegenerateSectionModal } from "@/components/article-builder/outline/RegenerateSectionModal";
import { DraftEditor } from "@/components/article-builder/draft/DraftEditor";
import { StickyDraftActionBar } from "@/components/article-builder/draft/StickyDraftActionBar";
import { QualityCard, MetadataCard, PublishCard } from "@/components/article-builder/publish/WpMetadataPanel";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useGenerateArticleSections } from "@/hooks/useGenerateArticleSections";
import { useGenerateArticle } from "@/hooks/useGenerateArticle";
import { useReviseArticleSection } from "@/hooks/useReviseArticleSection";
import { useBuilderSessions } from "@/hooks/useBuilderSessions";
import { getBuilderSession, postBuilderSession, postGenerateMetadata, postSendToWordPress, postRefineDraft, postPublishLive, postRescore, postFixGeo } from "@/lib/api";
import {
  mapGeneratedSectionsToOutline,
  mapRevisedSectionToOutline,
  mapGenerateArticleResponseToDraft,
  outlineSectionToReviseSectionRequest,
  duplicateOutlineSection,
  defaultWpMetadata,
  draftToMarkdown,
} from "@/lib/article-builder-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OutlineSection, ArticleDraft, WordPressMetadata, QualityFlag, GeoScore, BrandVoiceStatus } from "@/types";
import type { Opportunity } from "@/types";
import type { AutosaveStatus } from "@/components/article-builder/AutosaveIndicator";
import type { BuilderStep } from "@/components/article-builder/BuilderStepper";

const FALLBACK_OPPORTUNITY: Opportunity = {
  id: "demo",
  title: "Demo opportunity",
  theme: "AI & Computer Vision",
  score: 75,
  priority: "moyenne",
  sources: [],
  content_brief: "Demo context.",
};

export default function ArticleBuilderPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading…</div>}>
      <ArticleBuilderContent />
    </Suspense>
  );
}

function ArticleBuilderContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const opportunityId = searchParams.get("opportunityId");
  const topicFromFlash = searchParams.get("topic");
  const titleFromTitle = searchParams.get("title");

  const opportunitiesQuery = useOpportunities();
  const { hasSession, registerSession, getSessionForOpportunity, updateSession } = useBuilderSessions();
  const [sentToWordPressAt, setSentToWordPressAt] = useState<string | null>(null);
  const [isSendingToWordPress, setIsSendingToWordPress] = useState(false);
  const [isPublishingLive, setIsPublishingLive] = useState(false);
  const [publishedLiveAt, setPublishedLiveAt] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const opportunities = opportunitiesQuery.data?.data ?? [];
  const opportunityFromList = opportunities.find((o) => o.id === opportunityId) ?? null;
  const flashOpportunity: Opportunity | null =
    opportunityId === "from-flash" && topicFromFlash
      ? { ...FALLBACK_OPPORTUNITY, id: "from-flash", title: decodeURIComponent(topicFromFlash) }
      : null;
  const titleOpportunity: Opportunity | null =
    opportunityId?.startsWith("from-title") && titleFromTitle
      ? { ...FALLBACK_OPPORTUNITY, id: opportunityId, title: decodeURIComponent(titleFromTitle) }
      : null;
  const keywordsOpportunity: Opportunity | null =
    opportunityId === "from-keywords" && topicFromFlash
      ? { ...FALLBACK_OPPORTUNITY, id: "from-keywords", title: decodeURIComponent(topicFromFlash) }
      : null;
  const commandOpportunity: Opportunity | null =
    opportunityId === "from-command" && topicFromFlash
      ? { ...FALLBACK_OPPORTUNITY, id: "from-command", title: decodeURIComponent(topicFromFlash) }
      : null;
  const opportunity: Opportunity | null =
    opportunityFromList || flashOpportunity || titleOpportunity || keywordsOpportunity || commandOpportunity || (opportunityId ? FALLBACK_OPPORTUNITY : null);

  /** Phase 5: real session ID for backend content endpoints (excludes flash/title/keywords/command). */
  const sessionOpportunityId =
    opportunityId &&
    opportunityId !== "from-flash" &&
    opportunityId !== "from-keywords" &&
    opportunityId !== "from-command" &&
    !opportunityId.startsWith("from-title")
      ? opportunityId
      : undefined;

  const [step, setStep] = useState<BuilderStep>(1);
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [wpMetadata, setWpMetadata] = useState<WordPressMetadata | null>(null);
  const [articleFinalised, setArticleFinalised] = useState(false);
  const [seoWarnings, setSeoWarnings] = useState<import("@/types").SeoWarning[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [outlineEditedAfterDraft, setOutlineEditedAfterDraft] = useState(false);
  const [draftEditedAfterMetadata, setDraftEditedAfterMetadata] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [regenSectionId, setRegenSectionId] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftLoadingMessage, setDraftLoadingMessage] = useState("");
  const [draftStreamingText, setDraftStreamingText] = useState("");
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);
  const [geoScore, setGeoScore] = useState<GeoScore | null | undefined>(undefined);
  const [brandVoiceStatus, setBrandVoiceStatus] = useState<BrandVoiceStatus | undefined>(undefined);
  const [outlineWarnings, setOutlineWarnings] = useState<import("@/types").OutlineWarning[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const outlineInitialized = useRef(false);
  const previousSectionForUndo = useRef<OutlineSection | null>(null);
  const previousOutlineForUndo = useRef<OutlineSection[] | null>(null);
  const metadataAutoFetchRef = useRef(false);
  const applyRevisionFromChatRef = useRef<((instruction: string) => Promise<void>) | null>(null);
  const generateSections = useGenerateArticleSections();
  const { generate: generateArticle, streamingText: articleStreamingText } = useGenerateArticle();
  const reviseSectionMutation = useReviseArticleSection();

  // Extra context from the radar opportunity — only populated for real opportunities (not flash/command/title)
  const oppCtx = sessionOpportunityId && opportunity
    ? {
        contentBrief: opportunity.content_brief,
        justificationSignals: opportunity.justification_signals,
        tags: opportunity.tags,
      }
    : {};
  const opportunityContext = sessionOpportunityId && opportunity
    ? {
        theme: opportunity.theme,
        intents: opportunity.intents,
        content_brief: opportunity.content_brief,
        justification_signals: opportunity.justification_signals,
        tags: opportunity.tags,
      }
    : undefined;

  useEffect(() => {
    if (!opportunityId) {
      router.replace("/atelier");
      return;
    }
  }, [opportunityId, router]);

  // Restore quality checks from localStorage when navigating back to an article
  useEffect(() => {
    if (!opportunityId) return;
    try {
      const raw = localStorage.getItem(`quality_${opportunityId}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as { geoScore?: GeoScore | null; brandVoiceStatus?: BrandVoiceStatus; qualityFlags?: QualityFlag[] };
      if (saved.geoScore !== undefined) setGeoScore(saved.geoScore);
      if (saved.brandVoiceStatus !== undefined) setBrandVoiceStatus(saved.brandVoiceStatus);
      if (saved.qualityFlags?.length) setQualityFlags(saved.qualityFlags);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  // Persist quality checks to localStorage whenever they change
  useEffect(() => {
    if (!opportunityId) return;
    if (geoScore === undefined && !brandVoiceStatus && qualityFlags.length === 0) return;
    try {
      localStorage.setItem(`quality_${opportunityId}`, JSON.stringify({ geoScore, brandVoiceStatus, qualityFlags }));
    } catch {}
  }, [opportunityId, geoScore, brandVoiceStatus, qualityFlags]);

  // Load session from API on mount (Phase 4)
  useEffect(() => {
    if (!opportunityId || !opportunity || outlineInitialized.current) return;
    
    // from-command: create session in DB first, then generate outline (persisted)
    if (opportunityId === "from-command") {
      outlineInitialized.current = true;
      setOutlineLoading(true);
      setOutlineError(null);
      postBuilderSession({ topic_title: opportunity.title })
        .then(async (session) => {
          const newSessionId = session.opportunityId;
          if (!newSessionId) throw new Error("Session not created");
          queryClient.setQueryData<import("@/types").BuilderSessionInfo[]>(["builder-sessions"], (prev) =>
            prev ? [session, ...prev] : [session]
          );
          const response = await generateSections.mutateAsync({
            topicTitle: opportunity.title,
            opportunityId: newSessionId,
            theme: opportunity.theme,
            intents: opportunity.intents,
            ...oppCtx,
          });
          return { response, newSessionId };
        })
        .then(({ response, newSessionId }) => {
          const newOutline = mapGeneratedSectionsToOutline(response);
          setOutline(newOutline);
          setOutlineError(null);
          router.replace(`/atelier/article-builder?opportunityId=${newSessionId}`);
        })
        .catch((error) => {
          setOutlineError(error instanceof Error ? error.message : "Unable to generate the outline automatically.");
          toast.error("Error generating the outline.");
          outlineInitialized.current = false;
        })
        .finally(() => setOutlineLoading(false));
      return;
    }

    // flash/title/keywords: create session first (like from-command), then generate outline
    if (opportunityId === "from-flash" || opportunityId.startsWith("from-title") || opportunityId === "from-keywords") {
      outlineInitialized.current = true;
      setOutlineLoading(true);
      setOutlineError(null);
      postBuilderSession({ topic_title: opportunity.title })
        .then(async (session) => {
          const newSessionId = session.opportunityId;
          if (!newSessionId) throw new Error("Session not created");
          queryClient.setQueryData<import("@/types").BuilderSessionInfo[]>(["builder-sessions"], (prev) =>
            prev ? [session, ...prev] : [session]
          );
          const response = await generateSections.mutateAsync({
            topicTitle: opportunity.title,
            opportunityId: newSessionId,
            theme: opportunity.theme,
            intents: opportunity.intents,
            ...oppCtx,
          });
          return { response, newSessionId };
        })
        .then(({ response, newSessionId }) => {
          const newOutline = mapGeneratedSectionsToOutline(response);
          setOutline(newOutline);
          setOutlineError(null);
          router.replace(`/atelier/article-builder?opportunityId=${newSessionId}`);
        })
        .catch((error) => {
          setOutlineError(error instanceof Error ? error.message : "Unable to generate the outline automatically.");
          toast.error("Error generating the outline.");
          outlineInitialized.current = false;
        })
        .finally(() => setOutlineLoading(false));
      return;
    }
    
    // Try to load session from API
    outlineInitialized.current = true;
    setOutlineLoading(true);
    setOutlineError(null);
    
    getBuilderSession(opportunityId)
      .then((session) => {
        // Backend returns 200 with { found: false } when no session (no 404)
        if (session && "found" in session && session.found === false) {
          // No session - create session first, then generate plan (Phase 5: backend updates session)
          const doGenerate = (sid: string) =>
            generateSections
              .mutateAsync({
                topicTitle: opportunity.title,
                opportunityId: sid,
                theme: opportunity.theme,
                intents: opportunity.intents,
                ...oppCtx,
              })
              .then((response) => {
                const newOutline = mapGeneratedSectionsToOutline(response);
                setOutline(newOutline);
                setOutlineError(null);
                registerSession(opportunityId, sid, opportunity.title).then(() => {
                  updateSession(sid, { outline: newOutline, currentStep: 1 });
                });
              })
              .catch((genError) => {
                setOutlineError(genError instanceof Error ? genError.message : "Unable to generate the outline automatically.");
                toast.error("Error generating the outline.");
                outlineInitialized.current = false;
              });
          return postBuilderSession({
            opportunity_id: sessionOpportunityId ?? opportunityId,
            topic_title: opportunity.title,
            opportunity_context: opportunityContext,
          }).then((s) => {
            const sid = s.opportunityId;
            if (!sid) throw new Error("Session not created");
            queryClient.setQueryData<import("@/types").BuilderSessionInfo[]>(["builder-sessions"], (prev) =>
              prev ? [s, ...prev] : [s]
            );
            return doGenerate(sid);
          });
        }
        // Session found - resume or generate outline if empty
        if (session?.outline && session.outline.length > 0) {
          setShowResumeDialog(true);
          setOutline(session.outline);
          if (session.draft) {
            const d = session.draft as unknown as Record<string, unknown>;
            setDraft(d?.sections ? mapGenerateArticleResponseToDraft(session.draft as unknown as Parameters<typeof mapGenerateArticleResponseToDraft>[0]) : session.draft as ArticleDraft);
          }
          if (session.wpMetadata) { setWpMetadata(session.wpMetadata); setArticleFinalised(true); }
          if (session.currentStep) setStep(Math.min(session.currentStep, 2) as 1 | 2);
        } else {
          // Session exists but no outline - generate new plan (Phase 5: backend updates session)
          return generateSections
            .mutateAsync({
              topicTitle: opportunity.title,
              opportunityId: sessionOpportunityId ?? opportunityId,
              theme: opportunity.theme,
              intents: opportunity.intents,
              ...oppCtx,
            })
            .then((response) => {
              const newOutline = mapGeneratedSectionsToOutline(response);
              setOutline(newOutline);
              setOutlineError(null);
              updateSession(opportunityId, { outline: newOutline, currentStep: 1 });
            })
            .catch((error) => {
              setOutlineError(error instanceof Error ? error.message : "Unable to generate the outline automatically.");
              toast.error("Error generating the outline.");
            });
        }
      })
      .catch((error) => {
        // Network or other error - fallback: create session then generate
        const sessionExists = hasSession(opportunityId);
        if (sessionExists) {
          setShowResumeDialog(true);
        } else {
          postBuilderSession({
            opportunity_id: sessionOpportunityId ?? opportunityId,
            topic_title: opportunity.title,
            opportunity_context: opportunityContext,
          })
            .then(async (s) => {
              const sid = s.opportunityId;
              if (!sid) throw new Error("Session not created");
              queryClient.setQueryData<import("@/types").BuilderSessionInfo[]>(["builder-sessions"], (prev) =>
                prev ? [s, ...prev] : [s]
              );
              const response = await generateSections.mutateAsync({
                topicTitle: opportunity.title,
                opportunityId: sid,
                theme: opportunity.theme,
                intents: opportunity.intents,
                ...oppCtx,
              });
              const newOutline = mapGeneratedSectionsToOutline(response);
              setOutline(newOutline);
              setOutlineError(null);
              registerSession(opportunityId, sid, opportunity.title).then(() => {
                updateSession(sid, { outline: newOutline, currentStep: 1 });
              });
            })
            .catch((genError) => {
              setOutlineError(genError instanceof Error ? genError.message : "Unable to generate the outline automatically.");
              toast.error("Error generating the outline.");
              outlineInitialized.current = false;
            });
        }
      })
      .finally(() => setOutlineLoading(false));
  }, [opportunityId, opportunity, sessionOpportunityId, generateSections, hasSession, registerSession, updateSession, getSessionForOpportunity, queryClient]);

  const handleResume = async () => {
    setShowResumeDialog(false);
    
    if (!opportunityId || opportunityId === "from-flash") {
      // Can't resume flash sessions, generate new plan
      setOutlineLoading(true);
      setOutlineError(null);
      generateSections
        .mutateAsync({
          topicTitle: opportunity?.title ?? "",
          opportunityId: sessionOpportunityId,
          theme: opportunity?.theme,
          intents: opportunity?.intents,
          ...oppCtx,
        })
        .then((response) => {
          const newOutline = mapGeneratedSectionsToOutline(response);
          setOutline(newOutline);
          setOutlineError(null);
        })
        .catch((error) => {
          setOutlineError(error instanceof Error ? error.message : "Unable to generate the outline automatically.");
          toast.error("Error generating the outline.");
        })
        .finally(() => setOutlineLoading(false));
      return;
    }

    // Load existing session from API or cache
    try {
      const session = await getBuilderSession(opportunityId).catch(() => getSessionForOpportunity(opportunityId));
      if (session && "found" in session && session.found === false) {
        // No session - create then generate (Phase 5: backend updates session when sessionOpportunityId)
        setOutlineLoading(true);
        setOutlineError(null);
        const doGen = () =>
          generateSections
            .mutateAsync({
              topicTitle: opportunity?.title ?? "",
              opportunityId: sessionOpportunityId,
              theme: opportunity?.theme,
              intents: opportunity?.intents,
              ...oppCtx,
            })
            .then((response) => {
              const newOutline = mapGeneratedSectionsToOutline(response);
              setOutline(newOutline);
              setOutlineError(null);
              if (!sessionOpportunityId) {
                registerSession(opportunityId, opportunityId, opportunity?.title ?? "").then(() => {
                  updateSession(opportunityId, { outline: newOutline, currentStep: 1 });
                });
              }
            })
            .catch((error) => {
              setOutlineError(error instanceof Error ? error.message : "Unable to generate the outline.");
              toast.error("Error generating the outline.");
            })
            .finally(() => setOutlineLoading(false));
        if (sessionOpportunityId) {
          registerSession(opportunityId, opportunityId, opportunity?.title ?? "").then(doGen);
        } else {
          doGen();
        }
        return;
      }
      if (session?.outline && session.outline.length > 0) {
        // Restore outline and other session data
        setOutline(session.outline);
        if (session.draft) {
          const d = session.draft as unknown as Record<string, unknown>;
          setDraft(d?.sections ? mapGenerateArticleResponseToDraft(session.draft as unknown as Parameters<typeof mapGenerateArticleResponseToDraft>[0]) : session.draft as ArticleDraft);
        }
        if (session.wpMetadata) {
          setWpMetadata(session.wpMetadata);
          setArticleFinalised(true);
        }
        if (session.currentStep) {
          setStep(Math.min(session.currentStep, 2) as 1 | 2);
        }
        if ((session as { sentToWordPressAt?: string | null }).sentToWordPressAt) {
          setSentToWordPressAt((session as { sentToWordPressAt?: string | null }).sentToWordPressAt ?? null);
        }
        setOutlineError(null);
        toast.success("Session reprise.");
      } else {
        // Session exists but no outline, generate new plan (Phase 5: backend updates when sessionOpportunityId)
        setOutlineLoading(true);
        setOutlineError(null);
        generateSections
          .mutateAsync({
            topicTitle: opportunity?.title ?? "",
            opportunityId: sessionOpportunityId,
            theme: opportunity?.theme,
            intents: opportunity?.intents,
            ...oppCtx,
          })
          .then((response) => {
            const newOutline = mapGeneratedSectionsToOutline(response);
            setOutline(newOutline);
            setOutlineError(null);
            if (!sessionOpportunityId) {
              updateSession(opportunityId, { outline: newOutline, currentStep: 1 });
            }
          })
          .catch((error) => {
            setOutlineError(error instanceof Error ? error.message : "Unable to generate the outline automatically.");
            toast.error("Error generating the outline.");
          })
          .finally(() => setOutlineLoading(false));
      }
    } catch (error) {
      toast.error("Error loading the session.");
    }
  };

  const handleRestart = async () => {
    setShowResumeDialog(false);
    setOutline([]);
    setDraft(null);
    setWpMetadata(null);
    setSentToWordPressAt(null);
    setArticleFinalised(false);
    setStep(1);
    setOutlineLoading(true);
    setOutlineError(null);

    const doGenerate = () =>
      generateSections
        .mutateAsync({
          topicTitle: opportunity?.title ?? "",
          opportunityId: sessionOpportunityId,
          theme: opportunity?.theme,
          intents: opportunity?.intents,
          ...oppCtx,
        })
        .then(async (response) => {
          const newOutline = mapGeneratedSectionsToOutline(response);
          setOutline(newOutline);
          setOutlineError(null);
          if (opportunityId && opportunity && opportunityId !== "from-flash" && !sessionOpportunityId) {
            await registerSession(opportunityId, opportunityId, opportunity.title);
            await updateSession(opportunityId, { outline: newOutline, currentStep: 1 });
          }
        });

    if (sessionOpportunityId) {
      try {
        await updateSession(sessionOpportunityId, {
          outline: [],
          draft: null,
          wpMetadata: null,
          currentStep: 1,
        });
      } catch (e) {
        console.error("Failed to clear builder session:", e);
        toast.error("Unable to reset the session.");
        setOutlineLoading(false);
        return;
      }
    }

    doGenerate()
      .catch((error) => {
        setOutlineError(error instanceof Error ? error.message : "Unable to generate the outline automatically.");
        toast.error("Error generating the outline.");
      })
      .finally(() => setOutlineLoading(false));
  };

  const handleRetryOutline = useCallback(async () => {
    if (!opportunity || !opportunityId) return;
    outlineInitialized.current = false;
    setOutlineError(null);
    setOutlineLoading(true);
    if (sessionOpportunityId) {
      await registerSession(opportunityId, opportunityId, opportunity.title);
    }
    generateSections
      .mutateAsync({
        topicTitle: opportunity.title,
        opportunityId: sessionOpportunityId,
        theme: opportunity.theme,
        intents: opportunity.intents,
        ...oppCtx,
      })
      .then(async (response) => {
        const newOutline = mapGeneratedSectionsToOutline(response);
        setOutline(newOutline);
        setOutlineError(null);
        outlineInitialized.current = true;
        if (opportunityId && opportunityId !== "from-flash" && !sessionOpportunityId) {
          await registerSession(opportunityId, opportunityId, opportunity.title);
          await updateSession(opportunityId, { outline: newOutline, currentStep: 1 });
        }
      })
      .catch((error) => {
        setOutlineError(error instanceof Error ? error.message : "Unable to generate the outline automatically.");
        toast.error("Error generating the outline.");
        outlineInitialized.current = false; // Allow retry again
      })
      .finally(() => setOutlineLoading(false));
  }, [opportunity, opportunityId, generateSections, registerSession, updateSession]);

  // Track previous step to detect changes
  const previousStepRef = useRef<BuilderStep | null>(null);

  // Autosave on every step change (outline ↔ article ↔ metadata)
  // Saves on: outline→article, article→outline, article→metadata, metadata→article, metadata→outline
  useEffect(() => {
    if (previousStepRef.current === null || !opportunityId || opportunityId === "from-flash" || opportunityId === "from-command") {
      previousStepRef.current = step;
      return;
    }

    if (previousStepRef.current !== step) {
      setAutosaveStatus("saving");

      const updates: {
        outline?: OutlineSection[];
        draft?: ArticleDraft | null;
        wpMetadata?: WordPressMetadata | null;
        currentStep: 1 | 2;
      } = { currentStep: step };

      // Always include whatever data we have so each transition persists the full state
      if (outline.length > 0) updates.outline = outline;
      if (draft) updates.draft = draft;
      if (wpMetadata) updates.wpMetadata = wpMetadata;

      updateSession(opportunityId, updates)
        .then(() => {
          setLastSavedAt(new Date().toISOString());
          setAutosaveStatus("saved");
        })
        .catch((error) => {
          console.error("Autosave failed:", error);
          setAutosaveStatus("idle");
        });

      previousStepRef.current = step;
    }
  }, [step, opportunityId, outline, draft, wpMetadata, updateSession]);

  const handleStepChange = useCallback((newStep: BuilderStep) => {
    setStep(newStep);
  }, []);

  // Save then navigate when leaving builder for radar (outline/article/metadata → radar)
  const handleBackToRadar = useCallback(async () => {
    if (opportunityId && opportunityId !== "from-flash" && opportunityId !== "from-command") {
      setAutosaveStatus("saving");
      const updates: { outline?: OutlineSection[]; draft?: ArticleDraft | null; wpMetadata?: WordPressMetadata | null; currentStep: 1 | 2 } = { currentStep: step };
      if (outline.length > 0) updates.outline = outline;
      if (draft) updates.draft = draft;
      if (wpMetadata) updates.wpMetadata = wpMetadata;
      try {
        await updateSession(opportunityId, updates);
        setAutosaveStatus("saved");
      } catch (e) {
        console.error("Autosave before leaving failed:", e);
        setAutosaveStatus("idle");
      }
    }
    router.push("/atelier");
  }, [opportunityId, step, outline, draft, wpMetadata, updateSession, router]);

  // Refs for latest state so unmount cleanup can save (e.g. browser back, other navigation)
  const outlineRef = useRef(outline);
  const draftRef = useRef(draft);
  const wpMetadataRef = useRef(wpMetadata);
  const stepRef = useRef(step);
  const updateSessionRef = useRef(updateSession);
  
  // Keep refs up to date
  useEffect(() => {
    outlineRef.current = outline;
    draftRef.current = draft;
    wpMetadataRef.current = wpMetadata;
    stepRef.current = step;
    updateSessionRef.current = updateSession;
  }, [outline, draft, wpMetadata, step, updateSession]);

  // Sync outline warnings from last successful outline generation
  useEffect(() => {
    if (generateSections.data?.outline_warnings) {
      setOutlineWarnings(generateSections.data.outline_warnings);
    }
  }, [generateSections.data]);

  // Cleanup: save on unmount (browser back, navigation away, etc.)
  useEffect(() => {
    return () => {
      if (opportunityId && opportunityId !== "from-flash" && opportunityId !== "from-command") {
        const updates: {
          outline?: OutlineSection[];
          draft?: ArticleDraft | null;
          wpMetadata?: WordPressMetadata | null;
          currentStep: 1 | 2;
        } = { currentStep: stepRef.current };
        if (outlineRef.current.length > 0) updates.outline = outlineRef.current;
        if (draftRef.current) updates.draft = draftRef.current;
        if (wpMetadataRef.current) updates.wpMetadata = wpMetadataRef.current;
        // Use ref to avoid dependency issues
        updateSessionRef.current(opportunityId, updates).catch((e) =>
          console.error("Autosave on unmount failed:", e)
        );
      }
    };
  }, [opportunityId]);

  // Auto-generate metadata once when draft first becomes available and no metadata exists yet.
  useEffect(() => {
    if (!draft || wpMetadata || !sessionOpportunityId || metadataAutoFetchRef.current) return;
    metadataAutoFetchRef.current = true;
    void handleRegenerateMetadata();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!draft, sessionOpportunityId]);

  const handleSaveAsDraft = useCallback(() => {
    if (!draft) return;
    toast.success("Draft saved");
    router.push("/atelier/drafts");
  }, [draft, router]);

  const handleSendToWordPress = useCallback(async () => {
    if (!sessionOpportunityId || !draft) return;
    setIsSendingToWordPress(true);
    try {
      await updateSession(sessionOpportunityId, {
        draft,
        ...(wpMetadata && { wpMetadata }),
        currentStep: 2,
      });
      const res = await postSendToWordPress(sessionOpportunityId);
      setSentToWordPressAt(new Date().toISOString());
      if (res.metadata) setWpMetadata(res.metadata);
      if (res.brandVoiceStatus !== undefined) setBrandVoiceStatus(res.brandVoiceStatus);
      if (res.geoScore !== undefined) setGeoScore(res.geoScore);
      if (res.correctedDraft) setDraft(res.correctedDraft);
      queryClient.invalidateQueries({ queryKey: ["builder-sessions"] });
      toast.success(res.link ? `Draft saved to Sanity! ${res.link}` : "Draft saved to Sanity.");
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^API \d+:\s*/, "").slice(0, 120) : "";
      toast.error(msg ? `Couldn't save to Sanity: ${msg}` : "Couldn't save draft to Sanity.");
    } finally {
      setIsSendingToWordPress(false);
    }
  }, [sessionOpportunityId, draft, wpMetadata, updateSession, queryClient]);

  const handlePublishLive = useCallback(async () => {
    if (!sessionOpportunityId) return;
    setIsPublishingLive(true);
    try {
      const res = await postPublishLive(sessionOpportunityId);
      setPublishedLiveAt(new Date().toISOString());
      toast.success(res.link ? `Published live — ${res.link}` : "Published live on aitomarketgroup.com");
    } catch {
      toast.error("Couldn't publish live. Make sure you've saved as draft first.");
    } finally {
      setIsPublishingLive(false);
    }
  }, [sessionOpportunityId]);

  const handleRegenerateMetadata = useCallback(async () => {
    if (!draft) return;
    setMetadataLoading(true);
    try {
      if (sessionOpportunityId) {
        await updateSession(sessionOpportunityId, { draft, currentStep: 2 });
        const res = await postGenerateMetadata(sessionOpportunityId);
        setWpMetadata({
          title: res.title,
          slug: res.slug,
          excerpt: res.excerpt,
          category: res.category,
          tags: res.tags,
          focus_keyword: res.focus_keyword,
          seo_title: res.seo_title,
          seo_description: res.seo_description,
        });
        setSeoWarnings(res.seo_warnings ?? []);
      } else {
        setWpMetadata(defaultWpMetadata(opportunity?.title ?? "", draft.title));
      }
      setDraftEditedAfterMetadata(false);
    } catch {
      toast.error("Failed to regenerate metadata.");
    } finally {
      setMetadataLoading(false);
    }
  }, [draft, opportunity, sessionOpportunityId, updateSession]);

  const handleDismissMetadataBanner = useCallback(() => {
    setDraftEditedAfterMetadata(false);
  }, []);

  const handleSectionsChange = useCallback((sections: OutlineSection[]) => {
    setOutline(sections);
    if (draft) setOutlineEditedAfterDraft(true);
  }, [draft]);

  const handleRegenerateSection = useCallback(async () => {
    if (!regenSectionId) return;
    const sectionIndex = outline.findIndex((s) => s.id === regenSectionId);
    const section = outline[sectionIndex];
    if (!section) return;
    previousSectionForUndo.current = section;
    try {
      const baseSection = outlineSectionToReviseSectionRequest(
        section,
        sectionIndex + 1
      );
      const siblingsSections = outline
        .filter((s) => s.id !== section.id)
        .map((s) => ({ title: s.title, summary: s.content?.split("\n")[0]?.replace(/^•\s*/, "") ?? "" }));
      const revised = await reviseSectionMutation.mutateAsync({
        ...baseSection,
        change_request: regenInstruction.trim() || undefined,
        opportunityId: sessionOpportunityId,
        sibling_sections: siblingsSections,
      });
      const updated = mapRevisedSectionToOutline(section, revised);
      setOutline(outline.map((s) => (s.id === regenSectionId ? updated : s)));
      if (draft) setOutlineEditedAfterDraft(true);
      toast.success("Section regenerated", {
        action: {
          label: "Undo",
          onClick: () => {
            if (previousSectionForUndo.current) {
              setOutline((prev) =>
                prev.map((s) =>
                  s.id === previousSectionForUndo.current!.id
                    ? previousSectionForUndo.current!
                    : s
                )
              );
              previousSectionForUndo.current = null;
            }
          },
        },
      });
    } catch {
      toast.error("Failed to regenerate section.");
    } finally {
      setRegenSectionId(null);
      setRegenInstruction("");
      setRegenLoading(false);
    }
  }, [regenSectionId, regenInstruction, outline, draft, sessionOpportunityId, reviseSectionMutation]);

  const handleApplyToSectionFromChat = useCallback(
    async (sectionId: string, instruction: string) => {
      if (!sessionOpportunityId) {
        toast.error("Session required to apply the change.");
        return;
      }
      const sectionIndex = outline.findIndex((s) => s.id === sectionId);
      const section = outline[sectionIndex];
      if (!section) {
        toast.error("Section not found.");
        return;
      }
      previousSectionForUndo.current = section;
      try {
        const baseSection = outlineSectionToReviseSectionRequest(section, sectionIndex + 1);
        const siblingsSections = outline
          .filter((s) => s.id !== section.id)
          .map((s) => ({ title: s.title, summary: s.content?.split("\n")[0]?.replace(/^•\s*/, "") ?? "" }));
        const revised = await reviseSectionMutation.mutateAsync({
          ...baseSection,
          change_request: instruction.trim() || undefined,
          opportunityId: sessionOpportunityId,
          sibling_sections: siblingsSections,
        });
        const updated = mapRevisedSectionToOutline(section, revised);
        setOutline(outline.map((s) => (s.id === sectionId ? updated : s)));
        if (draft) setOutlineEditedAfterDraft(true);
        toast.success("Section updated from chat.");
      } catch {
        toast.error("Failed to apply change to section.");
      }
    },
    [outline, draft, sessionOpportunityId, reviseSectionMutation]
  );

  const handleDuplicateSection = useCallback((section: OutlineSection) => {
    const copy = duplicateOutlineSection(section);
    const index = outline.findIndex((s) => s.id === section.id);
    const next = [...outline];
    next.splice(index + 1, 0, copy);
    setOutline(next);
    if (draft) setOutlineEditedAfterDraft(true);
  }, [outline, draft]);

  const handleDeleteSection = useCallback((sectionId: string) => {
    const section = outline.find((s) => s.id === sectionId);
    if (!section) return;
    previousOutlineForUndo.current = outline;
    setOutline(outline.filter((s) => s.id !== sectionId));
    if (draft) setOutlineEditedAfterDraft(true);
    toast.success("Section deleted · Undo", {
      action: {
        label: "Undo",
        onClick: () => {
          if (previousOutlineForUndo.current) {
            setOutline(previousOutlineForUndo.current);
            previousOutlineForUndo.current = null;
          }
        },
      },
    });
  }, [outline, draft]);


  const handleValidatePlan = useCallback(() => {
    if (draft) {
      setStep(2);
      return;
    }
    setStep(2);
    setDraftLoading(true);
    setDraftStreamingText("");
    generateArticle(
      { outline, articleTitle: opportunity?.title ?? "Article", opportunityId: sessionOpportunityId },
      ({ draft: newDraft, qualityFlags: flags, geoScore: score, brandVoiceStatus: bvStatus }) => {
        setDraft(newDraft);
        setQualityFlags(flags);
        setGeoScore(score);
        setBrandVoiceStatus(bvStatus);
        setDraftEditedAfterMetadata(false);
        setDraftLoading(false);
        setDraftStreamingText("");
        if (opportunityId && opportunityId !== "from-flash" && !sessionOpportunityId) {
          updateSession(opportunityId, { draft: newDraft, currentStep: 2 }).catch(console.error);
        }
      },
      () => {
        toast.error("Unable to generate the article.");
        setDraftLoading(false);
        setDraftStreamingText("");
      }
    );
  }, [draft, opportunity, outline, sessionOpportunityId, opportunityId, updateSession, generateArticle]);

  const handleDraftUpdate = useCallback((updated: ArticleDraft) => {
    setDraft(updated);
    setDraftEditedAfterMetadata(true);
  }, []);

  const handleRefineDraft = useCallback(async () => {
    if (!sessionOpportunityId) {
      toast.error("Session required to refine the article.");
      return;
    }
    if (!draft) {
      toast.error("No draft to refine. Generate an article first.");
      return;
    }
    setIsRefining(true);
    try {
      const refined = await postRefineDraft(sessionOpportunityId, draft);
      setDraft(refined.draft);
      setGeoScore(refined.geoScore);
      setBrandVoiceStatus(refined.brandVoiceStatus);
      setDraftEditedAfterMetadata(true);
      toast.success("Article refined to industry level.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("Refine draft failed:", e);
      toast.error(`Refinement failed: ${message}`);
    } finally {
      setIsRefining(false);
    }
  }, [sessionOpportunityId, draft]);

  const handleRescore = useCallback(async () => {
    if (!sessionOpportunityId) {
      toast.error("Session required to re-run checks.");
      return;
    }
    setIsRescoring(true);
    try {
      const result = await postRescore(sessionOpportunityId, draft ?? undefined);
      setGeoScore(result.geoScore);
      setBrandVoiceStatus(result.brandVoiceStatus);
      toast.success("Checks updated.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Re-score failed: ${message}`);
    } finally {
      setIsRescoring(false);
    }
  }, [sessionOpportunityId, draft]);

  const handleFixGeoCheck = useCallback(async (checkLabel: string) => {
    if (!sessionOpportunityId) return;
    const res = await postFixGeo(sessionOpportunityId, checkLabel);
    setDraft(res.draft);
    setGeoScore(res.geoScore);
    toast.success(`GEO fix applied for "${checkLabel}".`);
  }, [sessionOpportunityId]);

  const handleWpMetadataUpdate = useCallback((updated: WordPressMetadata) => {
    setWpMetadata(updated);
  }, []);

  const handleUpdateDraftFromOutline = useCallback(async () => {
    if (!opportunity || !sessionOpportunityId) {
      toast.error("Session required to regenerate the article.");
      return;
    }
    setDraftLoading(true);
    setDraftStreamingText("");
    generateArticle(
      { outline, articleTitle: opportunity.title, opportunityId: sessionOpportunityId },
      ({ draft: newDraft, qualityFlags: flags, geoScore: score, brandVoiceStatus: bvStatus }) => {
        setDraft(newDraft);
        setQualityFlags(flags);
        setGeoScore(score);
        setBrandVoiceStatus(bvStatus);
        setOutlineEditedAfterDraft(false);
        setDraftEditedAfterMetadata(true);
        setDraftLoading(false);
        setDraftStreamingText("");
        toast.success("Article regenerated from the outline.");
      },
      () => {
        toast.error("Unable to regenerate the article.");
        setDraftLoading(false);
        setDraftStreamingText("");
      }
    );
  }, [opportunity, outline, sessionOpportunityId, generateArticle]);

  if (!opportunityId) return null;

  return (
    <>
      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume or start over?</DialogTitle>
            <DialogDescription>
              A session already exists for this opportunity. Do you want to resume where you left off or start over with a new outline?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleRestart}>
              Start over
            </Button>
            <Button onClick={handleResume}>
              Resume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <ArticleBuilderShell
      opportunity={opportunity}
      opportunityId={opportunityId ?? undefined}
      outline={outline}
      currentStep={step}
      onStepChange={handleStepChange}
      autosaveStatus={autosaveStatus}
      displayTitle={draft?.title ?? opportunity?.title}
      onTitleChange={step === 2 && draft ? (t) => handleDraftUpdate({ ...draft, title: t }) : undefined}
      canNavigateToStep={(s) => s === 1 || !!draft}
      sentToWordPressAt={sentToWordPressAt ?? getSessionForOpportunity(opportunityId ?? "")?.sentToWordPressAt}
      onBackToRadar={handleBackToRadar}
    >
      {step === 1 && (
        <>
          <div className="space-y-4 pb-32">
            <h2 className="text-lg font-semibold text-slate-800">Detailed outline</h2>
            {outlineLoading ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-slate-600">
                <OrganicLoader variant="breathing" size={72} aria-label="Generating outline" withPhrases={["Thinking…", "Mapping the structure…", "Finding the right angle…", "Drafting sections…", "Almost ready…"]} />
                <p className="mt-4 text-sm">Generating outline…</p>
              </div>
            ) : outlineError ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16 text-red-700">
                <p className="mb-2 text-sm font-medium">Error generating the outline</p>
                <p className="mb-4 text-xs text-red-600">{outlineError}</p>
                <Button onClick={handleRetryOutline}>
                  Retry
                </Button>
              </div>
            ) : outline.length > 0 ? (
              <>
                {outlineWarnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="mb-2 text-sm font-medium text-amber-800">Outline issues ({outlineWarnings.length})</p>
                        <ul className="space-y-1">
                          {outlineWarnings.map((w, i) => (
                            <li key={i} className="text-sm text-amber-700">• {w.message}</li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={() => setOutlineWarnings([])}
                        className="shrink-0 text-amber-500 hover:text-amber-700"
                        aria-label="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              <OutlineSectionList
                sections={outline}
                onSectionsChange={handleSectionsChange}
                onRegenerateSection={(id) => setRegenSectionId(id)}
                onDuplicateSection={handleDuplicateSection}
                onDeleteSection={handleDeleteSection}
              />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-slate-500">
                <p className="text-sm">No outline available.</p>
              </div>
            )}
          </div>
          <StickyActionBar
            onValidatePlan={handleValidatePlan}
            onBackToRadar={handleBackToRadar}
            isSaving={autosaveStatus === "saving"}
            canValidate={!outlineError && outline.length > 0}
          />
          <RegenerateSectionModal
            open={!!regenSectionId}
            onOpenChange={(open) => !open && setRegenSectionId(null)}
            instruction={regenInstruction}
            onInstructionChange={setRegenInstruction}
            onConfirm={() => {
              setRegenLoading(true);
              void handleRegenerateSection();
            }}
            isLoading={regenLoading}
          />
        </>
      )}

      {step === 2 && (
        <>
          {draftEditedAfterMetadata && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900">
                The article has changed. Would you like to regenerate the metadata?
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDismissMetadataBanner}>
                  Dismiss
                </Button>
                <Button size="sm" onClick={handleRegenerateMetadata} disabled={metadataLoading}>
                  {metadataLoading ? "Regenerating…" : "Regenerate"}
                </Button>
              </div>
            </div>
          )}
          {seoWarnings.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-amber-800">SEO issues ({seoWarnings.length})</p>
                  <ul className="space-y-1">
                    {seoWarnings.map((w, i) => (
                      <li key={i} className="text-sm text-amber-700">• {w.message}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleRegenerateMetadata} disabled={metadataLoading}>
                    {metadataLoading ? "Fixing…" : "Auto-fix"}
                  </Button>
                  <button
                    onClick={() => setSeoWarnings([])}
                    className="text-amber-500 hover:text-amber-700"
                    aria-label="Dismiss"
                  >✕</button>
                </div>
              </div>
            </div>
          )}

          {draftLoading ? (
            <div className="relative min-h-[480px] overflow-hidden rounded-xl">
              {articleStreamingText && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-pre-wrap p-8 font-mono text-xs text-slate-700 blur-md opacity-60"
                >
                  {articleStreamingText}
                </div>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
                <OrganicLoader
                  variant="lava"
                  size={96}
                  aria-label="Generating article"
                  withPhrases={["Drafting ideas…", "Weighing the arguments…", "Shaping the narrative…", "Adding depth…", "Connecting the dots…", "Polishing the prose…", "Reviewing the structure…", "Almost there…"]}
                />
              </div>
            </div>
          ) : draft ? (
            <>
              <div className="flex gap-4 pb-32">
                {/* Left: Writing Assistant — collapsed strip or expanded panel */}
                {chatOpen ? (
                  <div
                    className="w-72 shrink-0 sticky top-20 self-start flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                    style={{ height: "calc(100vh - 5.5rem)" }}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <span className="text-sm font-semibold text-slate-700">Writing Assistant</span>
                      <button
                        type="button"
                        onClick={() => setChatOpen(false)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Close writing assistant"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <ContentGenerationChat
                      isOpen
                      onOpenChange={() => {}}
                      variant="inline"
                      className="min-h-0 flex-1"
                      topicTitle={opportunity?.title ?? ""}
                      step={step}
                      storageKey={
                        sessionOpportunityId || opportunityId
                          ? `article-chat:${sessionOpportunityId ?? opportunityId}`
                          : undefined
                      }
                      outlineSummary={
                        outline.length > 0
                          ? outline.map((s) => s.title).join(" · ")
                          : ""
                      }
                      draftSummary={
                        draft.blocks
                          .filter((b) => b.type === "heading")
                          .map((b) => (b.content ?? "").replace(/<[^>]+>/g, "").trim())
                          .filter(Boolean)
                          .join(" · ")
                      }
                      outlineSections={outline.map((s) => ({ id: s.id, title: s.title }))}
                      onUseInstruction={(instruction) => {
                        setRegenInstruction(instruction);
                        toast.info("Instruction saved. Click Regenerate on a section to apply it.");
                      }}
                      onApplyToSection={
                        sessionOpportunityId && outline.length > 0
                          ? handleApplyToSectionFromChat
                          : undefined
                      }
                      onApplyToSelection={
                        (instruction) =>
                          applyRevisionFromChatRef.current?.(instruction) ?? Promise.resolve()
                      }
                    />
                  </div>
                ) : (
                  <div className="shrink-0 sticky top-20 self-start">
                    <button
                      type="button"
                      onClick={() => setChatOpen(true)}
                      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm hover:bg-slate-50 hover:shadow-md transition-shadow"
                      aria-label="Open writing assistant"
                    >
                      <MessageSquare className="h-4 w-4 text-emerald-700" />
                      <span className="text-xs font-medium text-emerald-700">Writing Assistant</span>
                    </button>
                  </div>
                )}

                {/* Middle: Article editor */}
                <div className="min-w-0 flex-1">
                  <DraftEditor
                    draft={draft}
                    onUpdate={handleDraftUpdate}
                    outlineEditedAfterDraft={outlineEditedAfterDraft}
                    onUpdateDraftFromOutline={handleUpdateDraftFromOutline}
                    onDismissOutlineBanner={() => setOutlineEditedAfterDraft(false)}
                    opportunityId={sessionOpportunityId}
                    registerApplyRevision={(apply) => {
                      applyRevisionFromChatRef.current = apply;
                    }}
                    brandVoiceResiduals={
                      brandVoiceStatus?.status === "partial"
                        ? brandVoiceStatus.residuals
                        : undefined
                    }
                  />
                </div>

                {/* Right: 3 sequential cards */}
                <aside className="w-80 shrink-0 sticky top-20 self-start overflow-y-auto max-h-[calc(100vh-5.5rem)] space-y-3 pb-4">
                  <QualityCard
                    geoScore={geoScore}
                    brandVoiceStatus={brandVoiceStatus}
                    onRescore={sessionOpportunityId && draft ? handleRescore : undefined}
                    isRescoring={isRescoring}
                    onFixCheck={sessionOpportunityId ? handleFixGeoCheck : undefined}
                  />
                  <MetadataCard
                    metadata={wpMetadata}
                    onUpdate={handleWpMetadataUpdate}
                    opportunityTitle={opportunity?.title}
                    isGenerating={metadataLoading}
                    onGenerate={handleRegenerateMetadata}
                    finalised={articleFinalised}
                    onFinalise={() => setArticleFinalised(true)}
                  />
                  <PublishCard
                    canSaveDraft={!!sessionOpportunityId && !!draft}
                    hasMetadata={!!wpMetadata}
                    locked={!articleFinalised}
                    onSaveDraft={handleSendToWordPress}
                    isSaving={isSendingToWordPress}
                    sentAt={sentToWordPressAt ?? getSessionForOpportunity(opportunityId ?? "")?.sentToWordPressAt}
                    onPublishLive={handlePublishLive}
                    isPublishingLive={isPublishingLive}
                    publishedLiveAt={publishedLiveAt}
                  />
                </aside>
              </div>

              <StickyDraftActionBar
                onBackToPlan={() => setStep(1)}
                onSaveAsDraft={draft ? handleSaveAsDraft : undefined}
                isSavingDraft={isSavingDraft}
                onRefineDraft={sessionOpportunityId ? handleRefineDraft : undefined}
                isRefining={isRefining}
                isSaving={autosaveStatus === "saving"}
              />
            </>
          ) : (
            <p className="text-slate-500">No draft yet. Validate the outline first.</p>
          )}
        </>
      )}

      {step === 1 && (
        <ContentGenerationChat
          isOpen={chatOpen}
          onOpenChange={setChatOpen}
          topicTitle={opportunity?.title ?? ""}
          step={step}
          storageKey={
            sessionOpportunityId || opportunityId
              ? `article-chat:${sessionOpportunityId ?? opportunityId}`
              : undefined
          }
          outlineSummary={
            outline.length > 0
              ? outline.map((s) => s.title).join(" · ")
              : ""
          }
          draftSummary={
            draft?.blocks
              ? draft.blocks
                  .filter((b) => b.type === "heading")
                  .map((b) => (b.content ?? "").replace(/<[^>]+>/g, "").trim())
                  .filter(Boolean)
                  .join(" · ")
              : ""
          }
          outlineSections={outline.map((s) => ({ id: s.id, title: s.title }))}
          onUseInstruction={(instruction) => {
            setRegenInstruction(instruction);
            toast.info(
              "Instruction saved. Click Regenerate on a section to apply it."
            );
          }}
          onApplyToSection={sessionOpportunityId && outline.length > 0 ? handleApplyToSectionFromChat : undefined}
          onApplyToSelection={undefined}
        />
      )}
    </ArticleBuilderShell>
    </>
  );
}
