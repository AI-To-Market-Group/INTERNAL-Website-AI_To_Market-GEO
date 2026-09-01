"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface MiniChartDataPoint {
  label: string;
  value: number;
}

interface MiniChartProps {
  data: MiniChartDataPoint[];
  title?: string;
  unit?: string;
  subtitle?: string;
  totalValue?: number;
  totalLabel?: string;
  className?: string;
}

export function MiniChart({
  data,
  title = "Activity",
  unit = "",
  subtitle,
  totalValue,
  totalLabel,
  className,
}: MiniChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  useEffect(() => {
    if (hoveredIndex !== null) setDisplayValue(data[hoveredIndex].value);
  }, [hoveredIndex, data]);

  const handleLeave = () => {
    setIsHovering(false);
    setHoveredIndex(null);
    setTimeout(() => setDisplayValue(null), 150);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleLeave}
      className={cn(
        "group relative w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm",
        "transition-all duration-300 hover:shadow-md",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
          {subtitle && <span className="text-xs text-slate-300">· {subtitle}</span>}
        </div>
        <div className="relative h-7 flex items-center gap-1">
          {totalValue !== undefined && !isHovering && (
            <span className="text-lg font-bold tabular-nums text-slate-900">
              {totalValue.toLocaleString()}
              {totalLabel && <span className="text-xs font-normal text-slate-400 ml-1">{totalLabel}</span>}
            </span>
          )}
          <span className={cn(
            "text-lg font-semibold tabular-nums transition-all duration-300 ease-out",
            isHovering && displayValue !== null ? "opacity-100 text-slate-900" : "opacity-0 pointer-events-none absolute",
          )}>
            {displayValue !== null ? displayValue.toLocaleString() : ""}
            {unit && (
              <span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>
            )}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end gap-1.5 h-24">
        {data.map((item, index) => {
          const heightPx = Math.max((item.value / maxValue) * 96, 4);
          const isHovered = hoveredIndex === index;
          const isAnyHovered = hoveredIndex !== null;
          const isNeighbor = hoveredIndex !== null && Math.abs(index - hoveredIndex) === 1;

          return (
            <div
              key={`${item.label}-${index}`}
              className="relative flex-1 flex flex-col items-center justify-end h-full"
              onMouseEnter={() => setHoveredIndex(index)}
            >
              <div
                className={cn(
                  "w-full rounded-full cursor-pointer transition-all duration-300 ease-out origin-bottom",
                  isHovered
                    ? "bg-slate-800"
                    : isNeighbor
                      ? "bg-slate-800/30"
                      : isAnyHovered
                        ? "bg-slate-800/10"
                        : "bg-slate-800/20 group-hover:bg-slate-800/25",
                )}
                style={{
                  height: `${heightPx}px`,
                  transform: isHovered ? "scaleX(1.15) scaleY(1.02)" : isNeighbor ? "scaleX(1.05)" : "scaleX(1)",
                }}
              />
              <span className={cn(
                "text-[10px] font-medium mt-2 transition-all duration-300 select-none",
                isHovered ? "text-slate-700" : "text-slate-300",
              )}>
                {data.length <= 7
                  // Week: "Mo" "Tu" "We" "Th" "Fr" "Sa" "Su"
                  ? item.label.slice(0, 2)
                  : data.length <= 31
                    // Month: show day number every 7 bars, blank otherwise
                    ? (index === 0 || index % 7 === 6) ? item.label : ""
                    // Year: 3-char month "Jan" "Feb"…
                    : item.label.slice(0, 3)
                }
              </span>

              {/* Tooltip */}
              <div className={cn(
                "absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-slate-900 text-white text-xs font-medium transition-all duration-200 whitespace-nowrap z-10",
                isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none",
              )}>
                {item.value.toLocaleString()}{unit}
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-slate-50/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}
