"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface RichTextBlockContentProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

/** Paragraph block contenteditable; formatting is applied by the global toolbar. */
export function RichTextBlockContent({
  value,
  onChange,
  placeholder = "Start writing…",
  className,
  onFocus,
  onBlur,
}: RichTextBlockContentProps) {
  const elRef = useRef<HTMLDivElement>(null);
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

  return (
    <div
      ref={elRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={cn(
        "w-full text-base text-gray-700 border-none outline-none bg-transparent placeholder-gray-400 resize-none leading-relaxed py-2 break-words min-h-[4.5rem]",
        "empty:before:pointer-events-none empty:before:float-left empty:before:h-0 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600",
        className
      )}
      style={{
        lineHeight: 1.8,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        minWidth: 0,
      }}
      onInput={syncToState}
      onFocus={onFocus}
      onBlur={() => {
        syncToState();
        onBlur?.();
      }}
    />
  );
}
