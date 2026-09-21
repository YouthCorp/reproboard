"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "zustand";
import type { AppSupabase } from "@/lib/supabase/browser";
import { executeIssueCommand, type BoardCommand, type CommandResult, type Issue } from "./commands";
import { acceptIssue } from "./issue-cache";
import { createCommandStore, issueCommandKey } from "./command-store";

type Owner = { store: ReturnType<typeof createCommandStore>; run: (command: BoardCommand) => Promise<CommandResult> };
const Context = createContext<Owner | null>(null);

export function IssueCommands({ client, children }: { client: AppSupabase; children: React.ReactNode }) {
  const cache = useQueryClient();
  const [store] = useState(createCommandStore);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function run(command: BoardCommand): Promise<CommandResult> {
    // Synchronous reservation closes the double-click/drag/detail race before any await.
    if (!store.getState().begin(command)) return { ok: false, code: "VALIDATION", message: "이 이슈의 이전 요청 결과를 먼저 확인하세요." };
    let result: CommandResult;
    try { result = await executeIssueCommand(client, command); }
    catch (error) { if (active.current) store.getState().uncertain(command); throw error; }
    if (!active.current) return result;
    if (result.ok) cache.setQueryData<Issue[]>(["issues", command.workspaceId], (old) => acceptIssue(old, result.data));
    // Never restore an array snapshot. Successful server data is committed before removing this overlay.
    store.getState().finish(command, result.ok ? `${result.data.issue_key} 저장했습니다.` : result.message);
    for (const key of ["issues", "verification-runs", "transitions", "membership", "members"]) {
      void cache.invalidateQueries({ queryKey: [key, command.workspaceId] });
    }
    return result;
  }
  return <Context.Provider value={{ store, run }}>{children}</Context.Provider>;
}

export function useIssueCommands() {
  const context = useContext(Context);
  if (!context) throw new Error("IssueCommands is required");
  return context;
}
export function useIssueRequest(workspaceId: string, issueId?: string) {
  const { store } = useIssueCommands();
  return useStore(store, (state) => issueId ? state.requests[issueCommandKey(workspaceId, issueId)] : undefined);
}
