"use client";

import { usePrefetchDashboardData } from "@/hooks/usePrefetchDashboardData";

export default function AtelierV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  usePrefetchDashboardData();
  return <>{children}</>;
}
