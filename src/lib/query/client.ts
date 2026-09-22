import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({ defaultOptions: {
    queries: { staleTime: 30_000, retry: false, networkMode: "always" },
    // Never persist, pause, or automatically resume a write after reconnect.
    mutations: { retry: false, networkMode: "always" },
  } });
}
