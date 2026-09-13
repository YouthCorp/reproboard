"use client";

import { ErrorState } from "@/components/error-state";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={retry} />;
}
