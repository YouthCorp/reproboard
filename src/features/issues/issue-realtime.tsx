"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { createRealtimeRefresh, type RealtimeState } from "./realtime-refresh";

export function IssueRealtime({ client, workspaceId }: { client: AppSupabase; workspaceId: string }) {
  const cache = useQueryClient();
  const [state, setState] = useState<RealtimeState>("connecting");
  useEffect(() => {
    let active = true;
    const refresh = createRealtimeRefresh(async () => {
      const keys = ["issues", "verification-runs", "transitions", "membership", "members"];
      // An initial GET may have begun before SUBSCRIBED. Never reuse that request.
      await Promise.all(keys.map((key) => cache.cancelQueries({ queryKey: [key, workspaceId] })));
      if (!active) return;
      await Promise.all(keys.map((key) => cache.invalidateQueries({ queryKey: [key, workspaceId] }, { throwOnError: true })));
    }, setState);
    const filter = { schema: "public", table: "issues", filter: `workspace_id=eq.${workspaceId}` };
    const channel = client.channel(`issues:${workspaceId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { ...filter, event: "INSERT" }, () => refresh.changed())
      .on("postgres_changes", { ...filter, event: "UPDATE" }, () => refresh.changed())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh.subscribed();
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) refresh.failed();
      });
    return () => { active = false; refresh.stop(); void client.removeChannel(channel); };
  }, [cache, client, workspaceId]);
  return <p className="realtime-status" role="status" data-realtime-state={state}>
    {state === "connecting" ? "실시간 구독 연결 중…" : state === "syncing" ? "변경 알림 수신 · 최신 목록 확인 중…" : state === "subscribed" ? "실시간 구독 중 · 변경 알림 후 서버를 다시 조회합니다." : "실시간 또는 최신 조회를 확인하지 못했습니다. 최신 목록 조회를 사용하세요."}
  </p>;
}
