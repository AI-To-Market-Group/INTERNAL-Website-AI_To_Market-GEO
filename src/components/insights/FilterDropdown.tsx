"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function FilterDropdown<T extends string>({
  label,
  options,
  selected,
  onChange,
  className,
}: {
  label: string;
  options: readonly T[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (selected.size === 0) return label;
    if (selected.size === 1) return Array.from(selected)[0];
    return `${selected.size} selected`;
  }, [label, selected]);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-xs",
          open && "border-primary ring-2 ring-primary/20"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className={cn("truncate", selected.size === 0 && "text-slate-400")}>
          {selectedLabel}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-2 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <div className="bg-sidebar px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground">
              {label}
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              <div className="space-y-1">
                {options.map((opt) => {
                  const checked = selected.has(opt);
                  return (
                    <label
                      key={opt}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50",
                        checked && "bg-primary/10"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = new Set(selected);
                          if (v) next.add(opt);
                          else next.delete(opt);
                          onChange(next);
                        }}
                      />
                      <span className="truncate">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

