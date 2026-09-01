"use client";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  className?: string;
}

const LABELS: Record<AutosaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  error: "Unable to save",
};

export function AutosaveIndicator({ status, className }: AutosaveIndicatorProps) {
  if (status === "idle") return null;
  return (
    <span
      className={className}
      role="status"
      aria-live="polite"
    >
      {LABELS[status]}
    </span>
  );
}
