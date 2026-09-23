"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { createRealtimeRefresh, type RealtimeState } from "./realtime-refresh";

const scopedKeys = ["issues", "verification-runs", "transitions", "membership", "members", "comments", "activity", "notifications"];
type HttpState = "unknown" | "checking" | "ok" | "error";
type Connection = { online: boolean; ws: "connecting" | "connected" | "error"; http: HttpState;
  sync: RealtimeState; refresh: () => void; reportHttp: (ok: boolean) => void };
const Context = createContext<Connection | null>(null);
export const useConnection = () => useContext(Context);

export function WorkspaceConnection({ client, workspaceId, children }: { client: AppSupabase; workspaceId: string; children: React.ReactNode }) {
  const cache = useQueryClient();
  const [online, setOnline] = useState(true);
  const [ws, setWs] = useState<Connection["ws"]>("connecting");
  const [http, setHttp] = useState<HttpState>("unknown");
  const [sync, setSync] = useState<RealtimeState>("connecting");
  const refreshRef = useRef<() => void>(() => {});
  const active = useRef(false);
  const httpFailed = useRef(false);
  const reportHttp = useCallback((ok: boolean) => {
    if (!active.current) return;
    const needsRecovery = httpFailed.current;
    httpFailed.current = !ok; setHttp(ok ? "ok" : "error");
    if (!ok) setSync("error");
    // A command response proves HTTP reachability, not that every failed read caught up.
    else if (needsRecovery) refreshRef.current();
  }, []);
  useEffect(() => {
    let alive = true, connected = false;
    active.current = true;
    let channel: ReturnType<AppSupabase["channel"]> | undefined;
    const scoped = (key: readonly unknown[]) => key[1] === workspaceId && scopedKeys.includes(String(key[0]));
    const queryListener = cache.getQueryCache().subscribe((event) => {
      if (!alive || event.type !== "updated" || !scoped(event.query.queryKey)) return;
      if (event.action.type === "error") { httpFailed.current = true; setHttp("error"); setSync("error"); }
      // Only a complete recovery snapshot can declare the workspace synchronized.
    });
    const refresh = createRealtimeRefresh(async () => {
      if (!navigator.onLine || !alive) throw new Error("OFFLINE");
      setHttp("checking");
      // Never reuse a pre-subscription read. Dirty events queue a trailing snapshot.
      await cache.cancelQueries({ predicate: (q) => scoped(q.queryKey) });
      if (!alive) return;
      try {
        await cache.invalidateQueries({ queryKey: ["membership", workspaceId] }, { throwOnError: true });
        if (!alive) return;
        await Promise.all(scopedKeys.filter((key) => key !== "membership").map((key) => cache.invalidateQueries({ queryKey: [key, workspaceId] }, { throwOnError: true })));
        if (alive) { httpFailed.current = false; setHttp("ok"); }
      } catch (error) { if (alive) { httpFailed.current = true; setHttp("error"); } throw error; }
    }, (state) => { if (alive) setSync(state); });
    function connect() {
      if (!alive || !navigator.onLine || channel) return;
      setWs("connecting");
      const current = client.channel(`issues:${workspaceId}:${crypto.randomUUID()}`);
      channel = current;
      const filter = { schema: "public", table: "issues", filter: `workspace_id=eq.${workspaceId}` };
      current.on("postgres_changes", { ...filter, event: "INSERT" }, () => refresh.changed())
        .on("postgres_changes", { ...filter, event: "UPDATE" }, () => refresh.changed())
        .on("postgres_changes", { ...filter, table: "comments", event: "INSERT" }, () => refresh.changed())
        .on("postgres_changes", { ...filter, table: "activity_events", event: "INSERT" }, () => refresh.changed())
        .on("postgres_changes", { ...filter, table: "notifications", event: "INSERT" }, () => refresh.changed())
        .on("postgres_changes", { ...filter, table: "notifications", event: "UPDATE" }, () => refresh.changed())
        .subscribe((status) => {
          if (!alive || channel !== current) return;
          if (status === "SUBSCRIBED") { connected = true; setWs("connected"); refresh.subscribed(); }
          else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            connected = false; setWs("error"); refresh.failed();
            // SDK owns rejoin; HTTP polling does not create another socket.
            if (navigator.onLine) refresh.poll();
          }
        });
    }
    function offline() {
      setOnline(false); connected = false; setWs("error"); refresh.failed();
      const previous = channel; channel = undefined;
      if (previous) void client.removeChannel(previous);
      void cache.cancelQueries({ predicate: (q) => scoped(q.queryKey) });
    }
    function recover() {
      if (!alive) return;
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      if (!channel) connect();
      else if (connected) refresh.subscribed();
      else refresh.poll();
    }
    function visible() { if (document.visibilityState === "visible") recover(); }
    refreshRef.current = recover;
    window.addEventListener("offline", offline); window.addEventListener("online", recover);
    window.addEventListener("focus", recover); document.addEventListener("visibilitychange", visible);
    // Fallback issue polling; membership is checked even when WS is healthy.
    const timer = setInterval(() => {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      if (!connected || httpFailed.current) refresh.poll();
      else void cache.invalidateQueries({ queryKey: ["membership", workspaceId] });
    }, 15_000);
    if (navigator.onLine) connect(); else offline();
    return () => {
      alive = false; active.current = false; refresh.stop(); queryListener(); clearInterval(timer);
      window.removeEventListener("offline", offline); window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover); document.removeEventListener("visibilitychange", visible);
      if (channel) void client.removeChannel(channel);
      // Strict Mode's immediate effect replay keeps the live scope. Real unmounts evict it.
      queueMicrotask(() => { if (!active.current) {
        void cache.cancelQueries({ predicate: (q) => scoped(q.queryKey) });
        cache.removeQueries({ predicate: (q) => scoped(q.queryKey) });
      } });
    };
  }, [cache, client, workspaceId]);
  return <Context.Provider value={{ online, ws, http, sync, reportHttp, refresh: () => refreshRef.current() }}>{children}</Context.Provider>;
}

export function IssueRealtime() {
  const state = useConnection()!;
  const status = connectionStatus(state);
  return <div className="realtime-status" role="status" data-connection-state={status}
    data-realtime-state={status === "normal" ? "subscribed" : status === "syncing" ? "syncing" : "error"} data-ws-state={state.ws} data-http-state={state.http}>
    <p>{connectionMessages[status]}</p>
    <span>Realtime: {{ connecting: "연결 중", connected: "연결됨", error: "불안정" }[state.ws]} · HTTP: {{ unknown: "미확인", checking: "조회 중", ok: "응답 확인", error: "요청 실패" }[state.http]}</span>{" "}
    <button type="button" className="button button-secondary" onClick={state.refresh} disabled={!state.online}>연결 상태 다시 확인</button>
  </div>;
}

function connectionStatus(state: Connection) {
  return !state.online ? "offline" : state.http === "error" ? "http-error" : state.ws !== "connected" ? "degraded"
    : state.sync !== "subscribed" || state.http !== "ok" ? "syncing" : "normal";
}
const connectionMessages = {
  offline: "오프라인 · 초안을 유지합니다. 새 저장은 보내지 않으며 연결 후에도 자동 전송하지 않습니다.",
  "http-error": "HTTP 요청 실패 · 저장을 보장할 수 없습니다. 결과 불명 요청은 같은 요청으로 직접 확인하세요.",
  degraded: "실시간 불안정 · HTTP 저장은 가능합니다. 15초 간격으로 임시 조회하며 초안을 유지합니다.",
  syncing: "동기화 중 · 구독과 최신 서버 값을 확인하고 있습니다. 초안을 유지합니다.",
  normal: "정상 · 실시간 구독과 최신 조회를 확인했습니다. 각 저장은 서버 응답으로 확인합니다.",
};

// Modal/mobile users must see the connection warning without closing their draft.
export function ConnectionHint() {
  const state = useConnection();
  if (!state || connectionStatus(state) === "normal") return null;
  return <p className="connection-hint" role="status">{connectionMessages[connectionStatus(state)]}</p>;
}
