"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Opportunity, OpportunityType } from "@/types";

interface Top4OpportunitiesTableProps {
  opportunities: Opportunity[];
  onGenerate: (id: string) => void;
  hasSession?: (id: string) => boolean;
  hasSentToWordPress?: (id: string) => boolean;
}

const getTypeLabel = (type: OpportunityType | undefined) => {
  if (type === "SEASONAL") return "Seasonal";
  if (type === "TREND") return "Trends";
  return "Competition";
};

const extractTopic = (title: string): string => {
  // Return the full title - no truncation
  return title;
};

const getThemeBadgeClass = (theme: string) => {
  const configs: Record<string, string> = {
    "Store Operational Excellence": "bg-primary/15 text-foreground border-transparent",
    "Data-Driven Commerce": "bg-primary/15 text-foreground border-transparent",
    "Retail Media & Shopper Experience": "bg-primary/15 text-foreground border-transparent",
    "AI & Computer Vision": "bg-primary/15 text-foreground border-transparent",
  };
  return configs[theme] ?? "bg-slate-100 text-slate-700 border-slate-200";
};

export const Top4OpportunitiesTable = ({
  opportunities,
  onGenerate,
  hasSession = () => false,
  hasSentToWordPress = () => false,
}: Top4OpportunitiesTableProps) => {
  const top4 = opportunities.slice(0, 4);

  if (top4.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-900">Top opportunities</h2>
      <p className="mt-1 text-sm text-slate-500">
        Top 4 opportunities ranked by score
      </p>
      <div className="mt-4 rounded-md border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="border-b">
            <TableHead className="h-10 px-2 text-left font-medium text-foreground">
              Topic
            </TableHead>
            <TableHead className="h-10 px-2 text-left font-medium text-foreground">
              Type
            </TableHead>
            <TableHead className="h-10 px-2 text-left font-medium text-foreground">
              Theme
            </TableHead>
            <TableHead className="h-10 px-2 text-left font-medium text-foreground">
              Score
            </TableHead>
            <TableHead className="h-10 w-40 px-2 text-left font-medium text-foreground">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top4.map((opp) => (
            <TableRow key={opp.id} className="border-b transition-colors hover:bg-slate-50">
              <TableCell className="p-2 font-medium align-middle">
                {extractTopic(opp.title)}
              </TableCell>
              <TableCell className="p-2 align-middle text-slate-700">
                {getTypeLabel(opp.type)}
              </TableCell>
              <TableCell className="p-2 align-middle">
                <Badge
                  variant="outline"
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                    getThemeBadgeClass(opp.theme ?? "—")
                  )}
                >
                  {opp.theme ?? "—"}
                </Badge>
              </TableCell>
              <TableCell className="p-2 font-semibold align-middle">
                {opp.score ?? opp.impact_score ?? 0}
              </TableCell>
              <TableCell className="p-2 align-middle">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-2 border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50"
                  onClick={() => onGenerate(opp.id)}
                >
                  {hasSentToWordPress(opp.id) ? "View article" : hasSession(opp.id) ? "Resume" : "Create article"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};
