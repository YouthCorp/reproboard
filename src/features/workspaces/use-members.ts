"use client";
import { useQuery } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
export function useMembers(client: AppSupabase, workspaceId: string) {
  return useQuery({ queryKey: ["members", workspaceId], queryFn: async ({ signal }) => {
    const result = await client.rpc("list_workspace_members", { p_workspace_id: workspaceId }).abortSignal(signal);
    if (result.error) throw new Error("팀 멤버를 불러오지 못했습니다.");
    return result.data;
  } });
}
