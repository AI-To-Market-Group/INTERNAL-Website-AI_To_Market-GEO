"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
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
import { formatNumber } from "@/lib/format";
import type { Opportunity, OpportunityType, SEOSubtype } from "@/types";

interface RadarTableProps {
  opportunities: Opportunity[];
  onGenerate: (id: string) => void;
  loadingOpportunities?: string[];
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;
}

const getTypeLabel = (type: OpportunityType, subtype: SEOSubtype | null) => {
  if (type === "SEASONAL") return "Seasonal";
  if (type === "TREND") return "Trend";
  if (subtype === "STRIKING_DISTANCE") return "Optimisation";
  if (subtype === "ZOMBIE_CONTENT") return "Maintenance";
  return "Gap";
};

const getTypeBadgeClass = (type: OpportunityType, subtype: SEOSubtype | null) => {
  if (type === "SEASONAL") return "bg-[#938FE7] text-white border-transparent"; // Mid Purple
  if (type === "TREND") return "bg-[#ABEFEB] text-[#0F766E] border-transparent"; // Mid Turquoise
  if (subtype === "STRIKING_DISTANCE")
    return "bg-[#CBFFA8] text-slate-900 border-transparent"; // Accent Green
  if (subtype === "ZOMBIE_CONTENT")
    return "bg-[#FFF27F] text-slate-900 border-transparent"; // Yellow
  return "bg-[#ABEFEB] text-[#0F766E] border-transparent"; // Mid Turquoise for Content Gap
};

const getSortIcon = (field: string, sortField?: string, sortDirection?: "asc" | "desc") => {
  if (sortField !== field) return <ArrowUpDown className="ml-1 h-4 w-4" />;
  return sortDirection === "asc" ? (
    <ArrowUp className="ml-1 h-4 w-4" />
  ) : (
    <ArrowDown className="ml-1 h-4 w-4" />
  );
};

export const RadarTable = ({
  opportunities,
  onGenerate,
  loadingOpportunities = [],
  sortField,
  sortDirection,
  onSort,
}: RadarTableProps) => {
  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sujet</TableHead>
            <TableHead>Type</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => onSort?.("search_volume")}
            >
              <span className="inline-flex items-center">
                Volume
                {getSortIcon("search_volume", sortField, sortDirection)}
              </span>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => onSort?.("impact_score")}
            >
              <span className="inline-flex items-center">
                Score
                {getSortIcon("impact_score", sortField, sortDirection)}
              </span>
            </TableHead>
            <TableHead className="w-40">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((opportunity) => (
            <TableRow key={opportunity.id} className="hover:bg-slate-50">
              <TableCell className="font-medium">{opportunity.title}</TableCell>
              <TableCell>
                <Badge variant="outline" className={getTypeBadgeClass(opportunity.type ?? "SEO_GAP", opportunity.subtype ?? null)}>
                  {getTypeLabel(opportunity.type ?? "SEO_GAP", opportunity.subtype ?? null)}
                </Badge>
              </TableCell>
              <TableCell>{formatNumber(opportunity.metrics?.search_volume ?? null)}</TableCell>
              <TableCell className="font-semibold">{opportunity.impact_score ?? opportunity.score ?? 0}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => onGenerate(opportunity.id)}
                  disabled={loadingOpportunities.includes(opportunity.id)}
                >
                  {loadingOpportunities.includes(opportunity.id) ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Create article"
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
