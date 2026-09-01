"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface ChartDataPoint {
  label: string;
  currentValue: number;
  previousValue: number;
}

export interface ActivityStatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  icon: React.ReactNode;
  mainValue: string;
  changeValue: number;
  changeDescription: string;
  chartData: ChartDataPoint[];
  onActionClick?: () => void;
  primaryBarClassName?: string;
  secondaryBarClassName?: string;
}

const ActivityStatsCard = React.forwardRef<HTMLDivElement, ActivityStatsCardProps>(
  (
    {
      className,
      title,
      icon,
      mainValue,
      changeValue,
      changeDescription,
      chartData,
      onActionClick,
      primaryBarClassName,
      secondaryBarClassName,
      ...props
    },
    ref
  ) => {
    const ChangeIndicator = changeValue > 0 ? ArrowUpRight : ArrowDownRight;
    const changeColor =
      changeValue > 0 ? "text-green-500" : changeValue < 0 ? "text-red-500" : "text-muted-foreground";

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
    };

    const barVariants = {
      hidden: { height: "0%", opacity: 0 },
      visible: (height: number) => ({
        height: `${height}%`,
        opacity: 1,
        transition: { type: "spring" as const, stiffness: 300, damping: 25 },
      }),
    };

    return (
      <Card className={cn("w-full overflow-hidden", className)} ref={ref} {...props}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-primary">{icon}</div>
              <CardTitle className="text-lg font-medium">{title}</CardTitle>
            </div>
            {onActionClick && (
              <Button variant="ghost" size="icon" onClick={onActionClick} aria-label="View details">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold tracking-tight text-card-foreground">{mainValue}</p>
          <div className={`flex items-center gap-1 text-sm ${changeColor}`}>
            <ChangeIndicator className="h-4 w-4" />
            <span>
              {Math.abs(changeValue)}%{" "}
              <span className="text-muted-foreground">{changeDescription}</span>
            </span>
          </div>
          <div className="mt-6 h-32 w-full">
            <AnimatePresence>
              <motion.div
                key="chart"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex h-full w-full items-end justify-between gap-2"
              >
                {chartData.map((point) => (
                  <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div className="relative flex h-full w-full items-end justify-center gap-1.5">
                      <motion.div
                        custom={point.currentValue}
                        variants={barVariants}
                        className={cn("w-full rounded-sm bg-primary", primaryBarClassName)}
                        aria-valuenow={point.currentValue}
                        role="progressbar"
                      />
                      <motion.div
                        custom={point.previousValue}
                        variants={barVariants}
                        className={cn("w-full rounded-sm bg-muted", secondaryBarClassName)}
                        aria-valuenow={point.previousValue}
                        role="progressbar"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{point.label}</span>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    );
  }
);
ActivityStatsCard.displayName = "ActivityStatsCard";
export { ActivityStatsCard };
