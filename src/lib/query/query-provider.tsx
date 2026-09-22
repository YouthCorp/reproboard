"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./client";
import { Suspense, useState } from "react";
import { LoadingState } from "@/components/loading-state";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Keep suspension below the client owner to preserve it on first mount. */}
      <Suspense fallback={<LoadingState />}>{children}</Suspense>
    </QueryClientProvider>
  );
}
