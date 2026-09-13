"use client";

import { ErrorState } from "@/components/error-state";
import "./globals.css";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="ko"><body><main><ErrorState onRetry={retry} /></main></body></html>;
}
