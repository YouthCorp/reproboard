"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { AppSupabase } from "@/lib/supabase/browser";
import { IssueForm } from "./issue-form";
import { IssueBoard } from "./issue-board";
import { IssueDetail } from "./issue-detail";
import { WorkspaceCreate } from "@/features/workspaces/workspace-create";
import { TeamManagement } from "@/features/workspaces/team-management";

export function LiveBoard({ client, user, signOut, signOutError }: { client: AppSupabase; user: User; signOut: () => Promise<void>; signOutError: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const workspaces = useQuery({ queryKey: ["workspaces", user.id], queryFn: async ({ signal }) => {
    const result = await client.from("workspaces").select("*").order("created_at").abortSignal(signal);
    if (result.error) throw new Error("팀을 불러오지 못했습니다.");
    return result.data;
  } });
  const workspaceId = params.get("workspace") ?? workspaces.data?.[0]?.id ?? "";
  const workspace = workspaces.data?.find((item) => item.id === workspaceId);
  const membership = useQuery({ queryKey: ["membership", workspaceId, user.id], enabled: !!workspace, refetchOnWindowFocus: "always",
    queryFn: async ({ signal }) => {
      const result = await client.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).abortSignal(signal).maybeSingle();
      if (result.error) throw new Error("권한을 확인하지 못했습니다.");
      return result.data;
    } });
  const issues = useQuery({ queryKey: ["issues", workspaceId], enabled: !!workspace && !!membership.data,
    queryFn: async ({ signal }) => {
      const result = await client.from("issues").select("*").eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false }).order("id").range(0, 500).abortSignal(signal);
      if (result.error) throw new Error("이슈를 불러오지 못했습니다.");
      if (result.data.length > 500) throw new Error("지원 범위인 500개를 초과했습니다. 전체 조회를 표시할 수 없습니다.");
      return result.data;
    } });
  const canWrite = membership.data?.role === "owner" || membership.data?.role === "member";
  const selectedId = params.get("issue");
  const selectedIssue = issues.data?.find((issue) => issue.id === selectedId);
  function selectIssue(id: string | null) {
    const next = new URLSearchParams(params.toString());
    next.set("workspace", workspaceId);
    if (id) next.set("issue", id); else next.delete("issue");
    router.push(`/board?${next.toString()}`, { scroll: false });
  }
  return <>
    <div className="session-bar">
      <span>로그인됨 · {typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : "사용자"}</span>
      <button className="button button-secondary" onClick={signOut}>로그아웃</button>
    </div>
    {signOutError && <p role="alert">{signOutError}</p>}
    <div className="page-heading"><div><h1>버그 보드</h1><p>재현에 필요한 정보를 모으고, 다음 작업을 준비하세요.</p></div></div>
    <p className="connection-notice">실제 팀 데이터가 DB에 저장됩니다. 개발 계정의 팀은 합성 데이터입니다. 상태 전환·재검증·실시간 반영은 아직 지원하지 않습니다.</p>
    <WorkspaceCreate client={client} />
    {workspaces.isError && workspaces.data && <p role="alert">최신 팀을 확인하지 못했습니다. <button onClick={() => workspaces.refetch()}>팀 다시 조회</button></p>}
    {workspaces.isPending ? <p role="status">팀을 불러오는 중…</p> : !workspaces.data ?
      <p role="alert">팀을 불러오지 못했습니다. <button onClick={() => workspaces.refetch()}>다시 조회</button></p> : <>
      <div className="workspace-toolbar">
        <label htmlFor="workspace-select">워크스페이스</label>
        <select id="workspace-select" value={workspace ? workspaceId : ""} onChange={(event) => {
          const next = new URLSearchParams(params.toString()); next.set("workspace", event.target.value); next.delete("issue");
          router.replace(`/board?${next.toString()}`);
        }}>
          <option disabled value="">팀 선택</option>
          {workspaces.data.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        {membership.data && <span>역할: {membership.data.role}</span>}
      </div>
      {!workspace ? <p role="status">접근할 수 있는 팀이 없습니다. 팀 주소와 로그인 계정을 확인하세요.</p> :
        membership.isPending ? <p role="status">권한을 확인하는 중…</p> : !membership.data ?
          <p role="alert">팀 권한을 확인할 수 없습니다. <button onClick={() => { membership.refetch(); workspaces.refetch(); }}>다시 조회</button></p> :
          <section className="live-inbox" key={`${user.id}/${workspaceId}`} aria-labelledby="inbox-title">
            <div className="board-caption"><h2 id="inbox-title">팀 이슈 · {issues.data?.length ?? "…"}개</h2>
              <button className="button button-secondary" onClick={() => { issues.refetch(); membership.refetch(); workspaces.refetch(); }}>최신 목록 조회</button></div>
            <TeamManagement client={client} workspaceId={workspaceId} isOwner={membership.data.role === "owner"} />
            {membership.isError && <p role="alert">최신 권한 확인에 실패했습니다. <button onClick={() => membership.refetch()}>권한 다시 조회</button></p>}
            {canWrite ? <IssueForm client={client} workspaceId={workspaceId} /> : <p className="read-only-note">Viewer는 조회만 할 수 있습니다.</p>}
            {issues.isPending && <p role="status">이슈를 불러오는 중…</p>}
            {issues.isError && <p role="alert">{issues.error.message} {issues.data && "마지막 조회 값을 표시합니다."} <button onClick={() => issues.refetch()}>다시 조회</button></p>}
            {issues.isFetching && !issues.isPending && <p role="status">최신 목록 확인 중…</p>}
            {issues.data && <>{issues.data.length === 0 && <p className="empty-inbox">아직 등록된 이슈가 없습니다.</p>}
              <IssueBoard issues={issues.data} select={selectIssue} /></>}
            {selectedId && <IssueDetail key={selectedId} client={client} workspaceId={workspaceId} issue={selectedIssue} canWrite={canWrite}
              loading={issues.isPending} error={issues.isError} refreshing={issues.isFetching}
              retry={() => { issues.refetch(); membership.refetch(); }} close={() => selectIssue(null)} />}
          </section>}
    </>}
  </>;
}
