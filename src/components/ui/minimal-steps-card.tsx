"use client";

import React, { useMemo, useEffect } from "react";
import { motion, useSpring, useTransform, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface BarData {
  value: number;
}

export interface MinimalStepsCardProps {
  title: string;
  subtitle: string;
  totalSteps: number;
  stepsUnit?: string;
  icon: React.ReactNode;
  data: BarData[];
  className?: string;
  barClassName?: string;
}

export const MinimalStepsCard = ({
  title,
  subtitle,
  totalSteps,
  stepsUnit = "steps",
  icon,
  data = [],
  className,
  barClassName,
}: MinimalStepsCardProps) => {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  const animatedSteps = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const displaySteps = useTransform(animatedSteps, (v) =>
    new Intl.NumberFormat("en-US").format(Math.round(v))
  );

  useEffect(() => {
    animatedSteps.set(totalSteps);
  }, [animatedSteps, totalSteps]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
  };

  const barVariants: Variants = {
    hidden: { height: "0%" },
    visible: (customHeight: string) => ({
      height: customHeight,
      transition: { type: "spring", stiffness: 100, damping: 12 },
    }),
  };

  return (
    <div
      className={cn("flex w-full flex-col rounded-2xl border bg-card p-6 text-card-foreground shadow-sm", className)}
      role="figure"
      aria-label={`${title} for ${subtitle}: ${totalSteps} ${stepsUnit}`}
    >
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      </header>

      <div className="my-6" aria-live="polite">
        <motion.span className="text-5xl font-bold tracking-tight">{displaySteps}</motion.span>
        <span className="ml-2 text-xl text-muted-foreground">{stepsUnit}</span>
      </div>

      <motion.div
        className="mt-auto flex h-28 w-full items-end gap-0.5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        aria-label={`${title} bar chart`}
      >
        {data.map((item, index) => {
          const barHeight = `${(item.value / maxValue) * 100}%`;
          return (
            <div key={index} className="relative h-full w-full" aria-label={`Point ${index + 1}: ${item.value}`}>
              <div className="absolute bottom-0 h-full w-full rounded-t-sm bg-muted/30" />
              <motion.div
                className={cn("absolute bottom-0 w-full rounded-t-sm bg-slate-700", barClassName)}
                variants={barVariants}
                custom={barHeight}
              />
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};
