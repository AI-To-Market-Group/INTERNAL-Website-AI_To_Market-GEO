"use client";

import { cn } from "@/lib/utils";

export function ImagePlaceholder({
  className,
  label = "Image",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50",
        className
      )}
      aria-label={label}
      role="img"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(253,205,56,0.25),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(13,33,38,0.15),transparent_45%)]" />
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700">
          {label} (placeholder)
        </div>
      </div>
    </div>
  );
}

