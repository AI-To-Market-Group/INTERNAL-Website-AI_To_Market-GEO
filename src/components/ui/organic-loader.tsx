"use client";

import { useId, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const THINKING_PHRASES = [
  "Thinking…",
  "Wondering…",
  "Connecting the dots…",
  "Finding the right angle…",
  "Reading between the lines…",
  "Drafting ideas…",
  "Analysing context…",
  "Weighing the options…",
  "Almost there…",
  "Crafting something good…",
];

function useRotatingPhrase(phrases: string[], intervalMs = 2800) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % phrases.length), intervalMs);
    return () => clearInterval(id);
  }, [phrases, intervalMs]);
  return phrases[index]!;
}

export type OrganicLoaderVariant =
  | "blob"
  | "breathing"
  | "taffy"
  | "lava"
  | "morph"
  | "ink"
  | "metaballs";

interface OrganicLoaderProps {
  variant?: OrganicLoaderVariant;
  size?: number;
  className?: string;
  "aria-label"?: string;
  /** Show rotating thinking phrases below the loader */
  withPhrases?: boolean | string[];
}

export function OrganicLoader({
  variant = "breathing",
  size = 48,
  className,
  "aria-label": ariaLabel = "Loading",
  withPhrases = false,
}: OrganicLoaderProps) {
  const phrases = Array.isArray(withPhrases)
    ? withPhrases
    : withPhrases
    ? THINKING_PHRASES
    : null;
  const phrase = useRotatingPhrase(phrases ?? THINKING_PHRASES);

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn("flex flex-col items-center gap-0", className)}
    >
      <div className="text-primary" style={{ width: size, height: size }}>
        <LoaderShape variant={variant} size={size} />
      </div>
      {phrases && (
        <p
          key={phrase}
          className="mt-4 animate-in fade-in duration-500 text-sm text-slate-400 italic tracking-wide"
        >
          {phrase}
        </p>
      )}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}

function LoaderShape({ variant, size }: { variant: OrganicLoaderVariant; size: number }) {
  const uid = useId().replace(/:/g, "");

  if (variant === "blob") {
    const d = size * 0.72;
    return (
      <div className="relative h-full w-full">
        <div
          className="ol-blob absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: d, height: d }}
        />
      </div>
    );
  }

  if (variant === "breathing") {
    const d = size * 0.76;
    return (
      <div className="relative h-full w-full">
        <div
          className="ol-breathing absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: d, height: d }}
        />
      </div>
    );
  }

  if (variant === "taffy") {
    const d = size * 0.66;
    return (
      <div className="relative h-full w-full">
        <div
          className="ol-taffy absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: d, height: d }}
        />
      </div>
    );
  }

  if (variant === "metaballs") {
    return (
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
        <defs>
          <filter id={`goo-${uid}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11" />
          </filter>
        </defs>
        <g filter={`url(#goo-${uid})`} fill="currentColor">
          <circle cx="60" cy="60" r="18" />
          <circle cx="60" cy="60" r="10">
            <animateMotion dur="2.2s" repeatCount="indefinite" path="M 0 0 a 30 30 0 1 0 .01 0" />
          </circle>
          <circle cx="60" cy="60" r="8">
            <animateMotion dur="2.2s" begin="-0.7s" repeatCount="indefinite" path="M 0 0 a 30 30 0 1 0 .01 0" />
          </circle>
          <circle cx="60" cy="60" r="6">
            <animateMotion dur="2.2s" begin="-1.4s" repeatCount="indefinite" path="M 0 0 a 30 30 0 1 0 .01 0" />
          </circle>
        </g>
      </svg>
    );
  }

  if (variant === "lava") {
    return (
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
        <defs>
          <filter id={`goo-${uid}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11" />
          </filter>
          <clipPath id={`cl-${uid}`}>
            <rect x="20" y="14" width="80" height="92" rx="32" />
          </clipPath>
        </defs>
        <rect
          x="20"
          y="14"
          width="80"
          height="92"
          rx="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.18"
        />
        <g clipPath={`url(#cl-${uid})`} filter={`url(#goo-${uid})`} fill="currentColor">
          <rect x="20" y="90" width="80" height="20" />
          <circle cx="48" cy="90" r="10">
            <animate attributeName="cy" values="96;24;96" dur="4s" repeatCount="indefinite" />
            <animate attributeName="r" values="10;14;10" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="72" cy="90" r="12">
            <animate attributeName="cy" values="96;18;96" dur="5.3s" begin="-1s" repeatCount="indefinite" />
            <animate attributeName="r" values="12;9;12" dur="5.3s" begin="-1s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="90" r="8">
            <animate attributeName="cy" values="96;30;96" dur="3.3s" begin="-2s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    );
  }

  if (variant === "ink") {
    return (
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
        <defs>
          <filter id={`ink-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3">
              <animate attributeName="baseFrequency" values="0.015;0.04;0.015" dur="5s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="14" />
          </filter>
        </defs>
        <g filter={`url(#ink-${uid})`}>
          <circle cx="60" cy="60" r="30" fill="currentColor">
            <animate attributeName="r" values="24;34;24" dur="3.2s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    );
  }

  // morph (default fallback)
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
      <path fill="currentColor">
        <animate
          attributeName="d"
          dur="4s"
          repeatCount="indefinite"
          values="
M60,22 C82,22 96,40 96,60 C96,82 80,98 60,98 C40,98 24,82 24,60 C24,40 38,22 60,22 Z;
M62,18 C88,22 100,44 94,66 C88,90 68,100 50,96 C28,92 20,72 24,52 C28,32 42,16 62,18 Z;
M58,24 C78,20 98,38 96,62 C94,84 76,100 56,96 C34,92 22,74 26,54 C30,36 42,26 58,24 Z;
M60,22 C82,22 96,40 96,60 C96,82 80,98 60,98 C40,98 24,82 24,60 C24,40 38,22 60,22 Z
"
        />
      </path>
    </svg>
  );
}
