"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Loader2, Send, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SuggestedActionType = "regenerate_section" | "revise_selection";

export interface SuggestedAction {
  type: SuggestedActionType;
  sectionId?: string;
  instruction?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** When the API returned a structured action suggestion */
  suggestedAction?: SuggestedAction;
}

export interface OutlineSectionOption {
  id: string;
  title: string;
}

interface ContentGenerationChatProps {
  /** Whether the chat panel is open */
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Article topic/title for context */
  topicTitle: string;
  /** Current builder step (1=outline, 2=draft, 3=publish) */
  step: 1 | 2 | 3;
  /** Short summary of outline for context (e.g. section titles) */
  outlineSummary?: string;
  /** Short summary of draft for context */
  draftSummary?: string;
  /** Sections for "Apply to section" (step 1) */
  outlineSections?: OutlineSectionOption[];
  /** Optional key to persist conversation in localStorage (per builder session) */
  storageKey?: string;
  /** When user clicks "Use as instruction", pass the suggested instruction to parent */
  onUseInstruction?: (instruction: string) => void;
  /** Apply assistant reply as instruction to a specific outline section (step 1) */
  onApplyToSection?: (sectionId: string, instruction: string) => Promise<void>;
  /** Apply assistant reply to replace current selection in draft (step 2) */
  onApplyToSelection?: (instruction: string) => Promise<void>;
  /** Optional class for the floating trigger when panel is closed */
  className?: string;
  /** Layout variant: slide-over panel (default) or inline box. */
  variant?: "panel" | "inline";
}

export function ContentGenerationChat({
  isOpen,
  onOpenChange,
  topicTitle,
  step,
  outlineSummary = "",
  draftSummary = "",
  outlineSections = [],
  storageKey,
  onUseInstruction,
  onApplyToSection,
  onApplyToSelection,
  className,
  variant = "panel",
}: ContentGenerationChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSectionByMessageId, setSelectedSectionByMessageId] = useState<Record<string, string>>({});
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Load persisted messages on first mount for this storage key
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    // Don't override if we already have messages (e.g. from this session)
    if (messages.length > 0) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { messages?: ChatMessage[] };
      if (Array.isArray(parsed.messages)) {
        setMessages(parsed.messages);
      }
    } catch {
      // ignore malformed data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist messages whenever they change
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (messages.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ messages }));
    } catch {
      // ignore quota or access errors
    }
  }, [storageKey, messages]);

  const conversationHistory = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const sendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue("");
    setError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/article-builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          step,
          topicTitle,
          outlineSummary: outlineSummary || undefined,
          draftSummary: draftSummary || undefined,
          outlineSections: outlineSections.length > 0 ? outlineSections : undefined,
          conversationHistory: conversationHistory,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        suggestedAction?: SuggestedAction;
      };

      if (!res.ok) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const fullText = data.reply ?? "";
      const messageId = `assistant-${Date.now()}`;

      // Add assistant message with empty content, then stream characters in the UI.
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          role: "assistant",
          content: "",
          suggestedAction: data.suggestedAction,
        },
      ]);

      if (!fullText) return;

      let index = 0;
      const stepSize = 6; // chars per frame
      const delayMs = 18; // frame delay

      const streamStep = () => {
        index = Math.min(index + stepSize, fullText.length);
        const slice = fullText.slice(0, index);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: slice,
                }
              : m
          )
        );
        if (index < fullText.length) {
          window.setTimeout(streamStep, delayMs);
        }
      };

      streamStep();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error sending message.";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: `Sorry, an error occurred: ${msg}. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Input is inside a form — Enter already triggers onSubmit.
    // Prevent the keydown from bubbling to avoid double-send.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
    }
  };
  const chatBody = (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-slate-900">
            Writing Assistant
          </h2>
        </div>
        {variant === "panel" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              Ask a question or request changes on the outline or draft.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              E.g. &quot;Make the intro shorter&quot;, &quot;Add a section on ROI&quot;
            </p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                msg.role === "user"
                  ? "ml-8 bg-primary text-primary-foreground"
                  : "mr-8 bg-slate-100 text-slate-800"
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === "assistant" && msg.content.trim().length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {msg.suggestedAction && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={applyingMessageId === msg.id}
                      onClick={async () => {
                        const action = msg.suggestedAction;
                        if (!action) return;
                        setApplyingMessageId(msg.id);
                        try {
                          if (action.type === "regenerate_section" && action.sectionId && onApplyToSection) {
                            await onApplyToSection(action.sectionId, action.instruction ?? msg.content);
                          } else if (action.type === "revise_selection" && onApplyToSelection) {
                            await onApplyToSelection(action.instruction ?? msg.content);
                          }
                        } finally {
                          setApplyingMessageId(null);
                        }
                      }}
                    >
                      {applyingMessageId === msg.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      {msg.suggestedAction?.type === "regenerate_section" && msg.suggestedAction?.sectionId
                        ? (() => {
                            const sec = outlineSections.find((s) => s.id === msg.suggestedAction?.sectionId);
                            return sec ? `Apply to « ${sec.title.slice(0, 25)}${sec.title.length > 25 ? "…" : ""} »` : "Apply to section";
                          })()
                        : "Apply to selection"}
                    </Button>
                  )}
                  {onUseInstruction && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-slate-600 hover:text-slate-900"
                      onClick={() => onUseInstruction(msg.content)}
                    >
                      Use as instruction
                    </Button>
                  )}
                  {step === 1 && outlineSections.length > 0 && onApplyToSection && !msg.suggestedAction && (
                    <div className="flex items-center gap-1.5">
                      <select
                        className="h-7 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        value={selectedSectionByMessageId[msg.id] ?? outlineSections[0]?.id ?? ""}
                        onChange={(e) =>
                          setSelectedSectionByMessageId((prev) => ({
                            ...prev,
                            [msg.id]: e.target.value,
                          }))
                        }
                        disabled={applyingMessageId === msg.id}
                      >
                        {outlineSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title.slice(0, 40)}{s.title.length > 40 ? "…" : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-slate-600 hover:text-slate-900"
                        disabled={applyingMessageId === msg.id}
                        onClick={async () => {
                          const sectionId = selectedSectionByMessageId[msg.id] ?? outlineSections[0]?.id;
                          if (!sectionId) return;
                          setApplyingMessageId(msg.id);
                          try {
                            await onApplyToSection(sectionId, msg.content);
                          } finally {
                            setApplyingMessageId(null);
                          }
                        }}
                      >
                        {applyingMessageId === msg.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        Apply to section
                      </Button>
                    </div>
                  )}
                  {step === 2 && onApplyToSelection && !msg.suggestedAction && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-slate-600 hover:text-slate-900"
                      disabled={applyingMessageId === msg.id}
                      onClick={async () => {
                        setApplyingMessageId(msg.id);
                        try {
                          await onApplyToSelection(msg.content);
                        } finally {
                          setApplyingMessageId(null);
                        }
                      }}
                    >
                      {applyingMessageId === msg.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Replace selection
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="mr-8 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}

      <form
        className="border-t border-slate-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
      >
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Your message…"
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </>
  );

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex h-full min-h-[260px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
          className
        )}
      >
        {chatBody}
      </div>
    );
  }

  return (
    <>
      {/* Floating trigger when panel is closed */}
      {!isOpen && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => onOpenChange(true)}
          className={cn(
            "fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full shadow-lg border-slate-200 bg-white hover:bg-slate-50",
            className
          )}
          aria-label="Open writing assistant"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Writing Assistant</span>
        </Button>
      )}

      {/* Chat slide-over panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {chatBody}
      </div>

      {/* Backdrop when open */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/20"
          aria-label="Close panel"
          onClick={() => onOpenChange(false)}
        />
      )}
    </>
  );
}
