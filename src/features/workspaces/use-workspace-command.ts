"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { executeWorkspaceCommand, type WorkspaceCommand, type WorkspaceResult } from "./commands";

export function useWorkspaceCommand(client: AppSupabase) {
  const cache = useQueryClient();
  const [unconfirmed, setUnconfirmed] = useState<WorkspaceCommand | null>(null);
  const [message, setMessage] = useState("");
  const mutation = useMutation({ mutationFn: (command: WorkspaceCommand) => executeWorkspaceCommand(client, command), retry: false, networkMode: "always" });
  async function run(command: WorkspaceCommand): Promise<Extract<WorkspaceResult, { ok: true }> | null> {
    setMessage("");
    try {
      const result = await mutation.mutateAsync(unconfirmed ?? command);
      setUnconfirmed(null);
      if (!result.ok) setMessage(result.message);
      // All membership-dependent reads return to the server, including after a denial.
      await Promise.all(["workspaces", "membership", "members", "permissions"].map((key) => cache.invalidateQueries({ queryKey: [key] })));
      mutation.reset();
      return result.ok ? result : null;
    } catch (error) {
      setUnconfirmed(unconfirmed ?? command);
      setMessage(error instanceof Error && error.message === "OFFLINE" ? "오프라인이라 요청을 보내지 않았습니다. 연결 후 직접 재시도하세요."
        : "저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인하세요.");
      return null;
    }
  }
  return { run, pending: mutation.isPending, unconfirmed, message, setMessage };
}
