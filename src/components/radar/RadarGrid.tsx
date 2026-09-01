"use client";

import type { Opportunity } from "@/types";
import { OpportunityCard } from "./OpportunityCard";

interface RadarGridProps {
  opportunities: Opportunity[];
  onGenerate: (id: string) => void;
  loadingOpportunities?: string[];
}

export const RadarGrid = ({
  opportunities,
  onGenerate,
  loadingOpportunities = [],
}: RadarGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 auto-rows-fr md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {opportunities.map((opportunity) => (
        <div key={opportunity.id} className="h-full">
          <OpportunityCard
            data={opportunity}
            onGenerate={onGenerate}
            isLoading={loadingOpportunities.includes(opportunity.id)}
          />
        </div>
      ))}
    </div>
  );
};
