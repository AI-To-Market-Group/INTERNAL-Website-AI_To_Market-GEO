"use client";

import { useRouter } from "next/navigation";
import { BookmarkPlus, FileText, ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { DraftCard } from "@/components/drafts/DraftCard";
import { useBuilderSessions } from "@/hooks/useBuilderSessions";
import { Button } from "@/components/ui/button";
import type { BuilderSessionInfo } from "@/types";

export default function DraftsPage() {
  const router  = useRouter();
  const { sessions, isLoading, deleteSession } = useBuilderSessions();

  // Only sessions that have reached the article draft stage
  const drafts: BuilderSessionInfo[] = (sessions ?? []).filter(
    (s) => s.draft != null || (s.currentStep ?? 1) >= 2
  );

  function handleOpen(opportunityId: string) {
    router.push(`/atelier/article-builder?opportunityId=${opportunityId}`);
  }

  function handleDelete(opportunityId: string) {
    deleteSession?.(opportunityId);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/atelier")}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to radar
            </button>
            <div className="flex items-center gap-3">
              <BookmarkPlus className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-slate-900">Saved Drafts</h1>
              {!isLoading && drafts.length > 0 && (
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-sm font-semibold text-slate-600">
                  {drafts.length}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              Articles in progress. Pick up where you left off.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/atelier")}
            className="shrink-0"
          >
            New article
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
            <FileText className="mb-4 h-10 w-10 text-slate-300" />
            <p className="text-base font-semibold text-slate-500">No drafts yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Start an article from the radar and click "Save as Draft" to see it here.
            </p>
            <Button
              className="mt-6"
              onClick={() => router.push("/atelier")}
            >
              Go to radar
            </Button>
          </div>
        )}

        {/* Draft cards grid */}
        {!isLoading && drafts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {drafts.map((session) => (
              <DraftCard
                key={session.opportunityId}
                session={session}
                onOpen={handleOpen}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
