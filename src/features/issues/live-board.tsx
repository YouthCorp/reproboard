"use client";

import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import type { AppSupabase } from "@/lib/supabase/browser";
import { PermissionIssueForm } from "./issue-form";
import { IssueBoard } from "./issue-board";
import { IssueDetail } from "./issue-detail";
import { WorkspaceCreate } from "@/features/workspaces/workspace-create";
import { TeamManagement } from "@/features/workspaces/team-management";
import { roleLabels } from "@/features/workspaces/role-labels";
import { Notifications } from "@/features/comments/notifications";
import { IssueCommands } from "./issue-commands";
import { mergeIssueSnapshot } from "./issue-cache";
import type { Issue } from "./commands";
import { IssueRealtime, WorkspaceConnection } from "./issue-realtime";
import { useBoardUrl } from "./use-board-url";
import { visibleIssues } from "./board-url";
import { BoardFilters } from "./board-filters";

export function LiveBoard({ client, user, signOut, signOutError }: { client: AppSupabase; user: User; signOut: () => Promise<void>; signOutError: string }) {
  const workspaces = useQuery({ queryKey: ["workspaces", user.id], queryFn: async ({ signal }) => {
    const result = await client.from("workspaces").select("*").order("created_at").abortSignal(signal);
    if (result.error) throw new Error("팀을 불러오지 못했습니다.");
    return result.data;
  } });
  const { state: boardState, change } = useBoardUrl(workspaces.data?.[0]?.id ?? "");
  const workspaceId = boardState.workspace;
  const workspace = workspaces.data?.find((item) => item.id === workspaceId);
  const membership = useQuery({ queryKey: ["membership", workspaceId, user.id], enabled: !!workspace, refetchOnWindowFocus: "always",
    queryFn: async ({ signal }) => {
      const result = await client.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).abortSignal(signal).maybeSingle();
      if (result.error) throw new Error("권한을 확인하지 못했습니다.");
      return result.data;
    } });
  const issues = useQuery({ queryKey: ["issues", workspaceId], enabled: !!workspace && !!membership.data,
    structuralSharing: (old, next) => mergeIssueSnapshot(old as Issue[] | undefined, next as Issue[]),
    queryFn: async ({ signal }) => {
      const result = await client.from("issues").select("*").eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false }).order("id").range(0, 500).abortSignal(signal);
      if (result.error) throw new Error("버그를 불러오지 못했어요. 다시 시도해 주세요.");
      if (result.data.length > 500) throw new Error("지원 범위인 500개를 초과했습니다. 전체 조회를 표시할 수 없습니다.");
      return result.data;
    } });
  const canWrite = !membership.isError && (membership.data?.role === "owner" || membership.data?.role === "member");
  const selectedId = boardState.issue;
  const selectedIssue = issues.data?.find((issue) => issue.id === selectedId);
  const visible = visibleIssues(issues.data ?? [], boardState);
  function selectIssue(id: string | null) {
    change({ workspace: workspaceId, issue: id ?? "" }, "push");
  }
  return <>
    <div className="page-heading"><div><p className="page-eyebrow">REPRODUCE → RESOLVE → RECHECK</p><h1>버그 보드</h1><p>재현을 남기고, 수정한 버전에서 다시 확인하세요.</p></div><div className="session-bar">
      <span>로그인됨 · {typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : "사용자"}</span>
      <button className="button button-secondary" onClick={signOut}>로그아웃</button>
    </div></div>
    {signOutError && <p role="alert">{signOutError}</p>}
    {workspaces.isError && workspaces.data && <p role="alert">최신 팀을 확인하지 못했습니다. <button onClick={() => workspaces.refetch()}>팀 다시 조회</button></p>}
    {workspaces.isPending ? <p role="status">팀을 불러오는 중…</p> : !workspaces.data ?
      <p role="alert">팀을 불러오지 못했습니다. <button onClick={() => workspaces.refetch()}>다시 조회</button></p> : <>
      <div className="workspace-toolbar">
        <label htmlFor="workspace-select">작업할 팀</label>
        <select id="workspace-select" value={workspace ? workspaceId : ""} onChange={(event) => change({ workspace: event.target.value, issue: "", assignee: "" })}>
          <option disabled value="">팀 선택</option>
          {workspaces.data.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
        {membership.data && <span>역할: {roleLabels[membership.data.role]}</span>}
        {workspace?.name.startsWith("합성") && <span className="synthetic-label">합성 데이터</span>}
        <WorkspaceCreate client={client} />
      </div>
      {!workspace ? <p role="status">접근할 수 있는 팀이 없습니다. 팀 주소와 로그인 계정을 확인하세요.</p> :
        membership.isPending ? <p role="status">권한을 확인하는 중…</p> : !membership.data ?
          <p role="alert">팀 권한을 확인할 수 없습니다. <button onClick={() => { membership.refetch(); workspaces.refetch(); }}>다시 조회</button></p> :
          <WorkspaceConnection key={`${user.id}/${workspaceId}`} client={client} workspaceId={workspaceId}><IssueCommands client={client} canWrite={canWrite}><section className="live-inbox" aria-labelledby="inbox-title">
            <div className="board-tools">
              <IssueRealtime />
              <Notifications client={client} workspaceId={workspaceId} userId={user.id} selectIssue={selectIssue} />
              <TeamManagement client={client} workspaceId={workspaceId} isOwner={!membership.isError && membership.data.role === "owner"} />
            </div>
            {membership.isError && <p role="alert">최신 권한 확인에 실패했습니다. <button onClick={() => membership.refetch()}>권한 다시 조회</button></p>}
            {membership.data.role === "viewer" && <p className="read-only-note">읽기 전용입니다. 버그 내용을 확인할 수 있습니다.</p>}
            <PermissionIssueForm client={client} workspaceId={workspaceId} canWrite={canWrite} />
            <BoardFilters key={workspaceId} client={client} workspaceId={workspaceId} state={boardState} change={change} />
            {issues.isPending && <p role="status">버그를 불러오는 중…</p>}
            {issues.isError && <p role="alert">{issues.error.message} {issues.data && "마지막 조회 값을 표시합니다."} <button onClick={() => issues.refetch()}>다시 조회</button></p>}
            <div className="board-caption"><h2 id="inbox-title" tabIndex={-1}>진행 현황</h2><div className="board-caption-actions"><span role="status" className="board-fetch-status">{issues.isFetching && !issues.isPending ? "최신 목록 확인 중…" : ""}</span>{issues.data && <p role="status" className="board-result-count">조회 결과 {visible.length} / {issues.data.length}개</p>}<button className="button button-secondary" onClick={() => { issues.refetch(); membership.refetch(); workspaces.refetch(); }}>최신 목록 조회</button></div></div>
            {issues.data && <>{issues.data.length === 0 && <p className="empty-inbox">아직 등록된 버그가 없습니다. 제목만 적어 첫 버그를 등록해 보세요.</p>}
              {issues.data.length > 0 && visible.length === 0 && <p className="empty-inbox">조건에 맞는 버그가 없습니다. 검색어나 필터를 바꾸거나 초기화해 주세요.</p>}
              <IssueBoard client={client} workspaceId={workspaceId} issues={visible} canWrite={canWrite} select={selectIssue} /></>}
            {selectedId && <IssueDetail key={selectedId} client={client} workspaceId={workspaceId} issue={selectedIssue} canWrite={canWrite}
              loading={issues.isPending} error={issues.isError} refreshing={issues.isFetching}
              retry={() => { issues.refetch(); membership.refetch(); }} close={() => selectIssue(null)} />}
          </section></IssueCommands></WorkspaceConnection>}
    </>}
  </>;
}
