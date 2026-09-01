"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export const CardSkeleton = () => {
  return (
    <Card className="animate-pulse">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="h-6 w-24 rounded bg-slate-200" />
        <div className="h-8 w-10 rounded bg-slate-200" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-5 w-3/4 rounded bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-200" />
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <div className="grid w-full grid-cols-3 gap-3">
          <div className="h-4 rounded bg-slate-200" />
          <div className="h-4 rounded bg-slate-200" />
          <div className="h-4 rounded bg-slate-200" />
        </div>
        <div className="h-10 w-full rounded bg-slate-200" />
      </CardFooter>
    </Card>
  );
};
