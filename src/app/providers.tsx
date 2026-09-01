"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ApiModeProvider } from "@/hooks/useApiMode";

const queryClientDefaults = {
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min default (hooks can override)
      gcTime: 10 * 60 * 1000, // 10 min (ancien cacheTime)
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
};

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient(queryClientDefaults));

  return (
    <QueryClientProvider client={queryClient}>
      <ApiModeProvider>
        {children}
        <Toaster richColors />
      </ApiModeProvider>
    </QueryClientProvider>
  );
};
