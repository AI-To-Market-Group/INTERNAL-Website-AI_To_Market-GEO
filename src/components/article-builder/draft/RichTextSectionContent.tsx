"use client";

import { useRef, useEffect, useState } from "react";
import { Bold, Italic, List, Heading2, Heading3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextSectionContentProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function RichTextSectionContent({
  value,
  onChange,
  placeholder = "Contenu de la section…",
  className,
  onFocus,
  onBlur,
}: RichTextSectionContentProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const isInternalChange = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const current = el.innerHTML.trim();
    const next = value || "";
    if (current === next) return;
    if (/<[a-z][\s\S]*>/i.test(next)) {
      el.innerHTML = next;
    } else {
      el.textContent = next;
    }
  }, [value]);

  const syncToState = () => {
    const el = elRef.current;
    if (!el) return;
    const html = el.innerHTML.trim();
    if (html !== value) {
      isInternalChange.current = true;
      onChange(html === "" ? "" : html);
    }
  };

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value ?? undefined);
    elRef.current?.focus();
    setTimeout(syncToState, 0);
  };

  return (
    <div className={cn("relative", className)}>
      {showToolbar && (
        <div className="mb-2 flex flex-wrap gap-0.5 rounded-md border border-slate-200 bg-slate-100 p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-200"
            onClick={() => exec("bold")}
            title="Gras"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-200"
            onClick={() => exec("italic")}
            title="Italique"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-200"
            onClick={() => exec("insertUnorderedList")}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-200"
            onClick={() => exec("formatBlock", "h2")}
            title="Titre H2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-200"
            onClick={() => exec("formatBlock", "h3")}
            title="Titre H3"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div
        ref={elRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={cn(
          "min-h-[120px] w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary/30",
          "empty:before:pointer-events-none empty:before:float-left empty:before:h-0 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-3 [&_h2]:mb-1",
          "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-2 [&_h3]:mb-1",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2"
        )}
        onInput={syncToState}
        onFocus={() => {
          setShowToolbar(true);
          onFocus?.();
        }}
        onBlur={() => {
          setShowToolbar(false);
          syncToState();
          onBlur?.();
        }}
      />
    </div>
  );
}
