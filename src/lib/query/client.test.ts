import { afterEach, expect, it, vi } from "vitest";
import { onlineManager } from "@tanstack/react-query";
import { createQueryClient } from "./client";
import { executeIssueCommand } from "@/features/issues/commands";
import type { AppSupabase } from "@/lib/supabase/browser";
import { issueValues } from "@/features/issues/fields";

afterEach(() => { onlineManager.setOnline(true); vi.unstubAllGlobals(); });
it("an offline mutation fails before RPC and never pauses or resumes on reconnect", async () => {
  onlineManager.setOnline(false);
  vi.stubGlobal("navigator", { onLine: false });
  const cache = createQueryClient(); cache.mount();
  const rpc = vi.fn();
  const run = vi.fn(() => executeIssueCommand({ rpc } as unknown as AppSupabase, {
    operation: "create", workspaceId: "team", requestId: "request", payload: issueValues(),
  }));
  const mutation = cache.getMutationCache().build(cache, { mutationFn: run });
  await expect(mutation.execute(undefined)).rejects.toThrow("OFFLINE");
  expect(mutation.state.isPaused).toBe(false); expect(rpc).not.toHaveBeenCalled();
  onlineManager.setOnline(true);
  await cache.resumePausedMutations();
  expect(run).toHaveBeenCalledTimes(1); expect(mutation.state.status).toBe("error");
  cache.unmount(); cache.clear();
});
