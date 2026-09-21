"use client";

import { useQuery } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useMembers } from "@/features/workspaces/use-members";
import { boardColumns } from "./fields";

export function IssueHistory({ client, workspaceId, issueId }: { client: AppSupabase; workspaceId: string; issueId: string }) {
  const members = useMembers(client, workspaceId);
  const runs = useQuery({ queryKey: ["verification-runs", workspaceId, issueId], queryFn: async ({ signal }) => {
    const result = await client.from("verification_runs").select("*").eq("workspace_id", workspaceId).eq("issue_id", issueId).order("created_at", { ascending: false }).order("id").abortSignal(signal);
    if (result.error) throw new Error("검증 기록을 불러오지 못했습니다."); return result.data;
  } });
  const moves = useQuery({ queryKey: ["transitions", workspaceId, issueId], queryFn: async ({ signal }) => {
    const result = await client.from("activity_events").select("id,changes,created_at").eq("workspace_id", workspaceId).eq("issue_id", issueId).eq("event_type", "issue_status_changed").order("created_at", { ascending: false }).order("id").abortSignal(signal);
    if (result.error) throw new Error("상태 이력을 불러오지 못했습니다."); return result.data;
  } });
  const statusName = (value: unknown) => boardColumns.find((column) => column.id === value)?.name ?? "상태";
  return <section className="issue-history" aria-label="검증과 상태 이력"><h3>검증 기록</h3>
    {runs.isPending && <p role="status">검증 기록을 불러오는 중…</p>}
    {runs.isError && <p role="alert">검증 기록을 불러오지 못했습니다. <button onClick={() => runs.refetch()}>검증 기록 다시 조회</button></p>}
    {runs.data?.length === 0 && <p className="form-hint">아직 재검증 기록이 없습니다.</p>}
    <ol className="verification-list">{runs.data?.map((run) => <li key={run.id}>
      <strong className={run.result === "pass" ? "verification-pass" : "verification-fail"}>{run.result === "pass" ? "통과" : "실패"} · {run.tested_build}</strong>
      <p>환경: {run.tested_environment}</p>{run.note && <p>메모: {run.note}</p>}
      <p className="form-hint">{members.data?.find((m) => m.user_id === run.actor_id)?.display_name ?? "기록한 팀원"} · {new Date(run.created_at).toLocaleString("ko-KR")}</p>
    </li>)}</ol>
    <h3>상태 이력</h3>
    {moves.isPending && <p role="status">상태 이력을 불러오는 중…</p>}
    {moves.isError && <p role="alert">상태 이력을 불러오지 못했습니다. <button onClick={() => moves.refetch()}>상태 이력 다시 조회</button></p>}
    {moves.data?.length === 0 && <p className="form-hint">아직 상태 이동이 없습니다.</p>}
    <ol className="transition-history">{moves.data?.map((event) => {
      const change = event.changes && typeof event.changes === "object" && !Array.isArray(event.changes) ? event.changes : {};
      return <li key={event.id}><strong>{statusName(change.from_status)} → {statusName(change.to_status)}</strong>
        {typeof change.reason === "string" && change.reason && <p>사유: {change.reason}</p>}<time className="form-hint">{new Date(event.created_at).toLocaleString("ko-KR")}</time></li>;
    })}</ol>
  </section>;
}
