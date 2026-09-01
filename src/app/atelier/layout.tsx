"use client";

import { usePrefetchDashboardData } from "@/hooks/usePrefetchDashboardData";

/**
 * Dashboard layout. Preloads opportunities, settings and builder-sessions
 * in a single parallel wave. Child pages reuse the React Query cache,
 * reducing duplicate requests (React Strict Mode, multiple components).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  usePrefetchDashboardData();
  return <>{children}</>;
}
