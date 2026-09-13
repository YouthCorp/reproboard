"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { LoadingState } from "@/components/loading-state";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
      // Writes must never silently retry or wait for automatic online resume.
      // D2 adds explicit transport checks; D8 verifies actual offline recovery.
      mutations: { retry: false, networkMode: "always" },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {/* Keep suspension below the client owner to preserve it on first mount. */}
      <Suspense fallback={<LoadingState />}>{children}</Suspense>
    </QueryClientProvider>
  );
}
