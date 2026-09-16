"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { newInviteToken } from "./commands";
import { useWorkspaceCommand } from "./use-workspace-command";

function MemberRole({ client, workspaceId, member }: { client: AppSupabase; workspaceId: string; member: { user_id: string; role: string; display_name: string } }) {
  const command = useWorkspaceCommand(client);
  return <>
    <button className="button button-secondary" disabled={command.pending} onClick={async () => {
      const result = await command.run(command.unconfirmed ?? { operation: "change_member_role", workspaceId, requestId: crypto.randomUUID(),
        payload: { userId: member.user_id, expectedRole: member.role, role: member.role === "member" ? "viewer" : "member" } });
      if (result) command.setMessage("역할을 저장했습니다.");
    }}>{command.pending ? "변경 중…" : command.unconfirmed ? "같은 요청으로 다시 확인" : `${member.display_name} → ${member.role === "member" ? "Viewer" : "Member"}`}</button>
    <p role="status">{command.message}</p>
  </>;
}

function InviteCreate({ client, workspaceId }: { client: AppSupabase; workspaceId: string }) {
  const command = useWorkspaceCommand(client);
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  return <div className="invite-create">
    <p>로그인한 한 사람만 Member로 참여합니다. 생성 후 24시간 동안 유효합니다.</p>
    <button className="button button-primary" disabled={command.pending} onClick={async () => {
      const token = command.unconfirmed?.operation === "create_invite" ? String(command.unconfirmed.payload.token) : newInviteToken();
      const result = await command.run({ operation: "create_invite", workspaceId, requestId: crypto.randomUUID(), payload: { token } });
      if (result) { setLink(`${window.location.origin}/invite#${token}`); setExpiresAt(result.data.expiresAt ?? ""); }
    }}>{command.pending ? "생성 중…" : command.unconfirmed ? "같은 요청으로 다시 확인" : "Member 초대 링크 생성"}</button>
    {link && <div className="invite-result"><label htmlFor="invite-link">초대 링크</label>
      <input id="invite-link" value={link} readOnly onFocus={(event) => event.target.select()} />
      <button className="button button-secondary" onClick={async () => {
        try { await navigator.clipboard.writeText(link); command.setMessage("초대 링크를 복사했습니다."); }
        catch { command.setMessage("초대 링크를 선택해 직접 복사하세요."); }
      }}>링크 복사</button><p>만료: {new Date(expiresAt).toLocaleString("ko-KR")}</p>
      <p>링크를 가진 사람이 참여할 수 있습니다. 이 화면을 벗어나면 링크 원문을 다시 조회할 수 없습니다.</p></div>}
    <p role="status">{command.message}</p>
  </div>;
}

export function TeamManagement({ client, workspaceId, isOwner }: { client: AppSupabase; workspaceId: string; isOwner: boolean }) {
  const members = useQuery({ queryKey: ["members", workspaceId], queryFn: async ({ signal }) => {
    const result = await client.rpc("list_workspace_members", { p_workspace_id: workspaceId }).abortSignal(signal);
    if (result.error) throw new Error("팀 멤버를 불러오지 못했습니다.");
    return result.data;
  } });
  return <details className="team-panel"><summary>팀 멤버와 권한</summary>
    {members.isPending ? <p role="status">멤버를 불러오는 중…</p> : members.isError ? <p role="alert">팀 멤버를 불러오지 못했습니다. <button onClick={() => members.refetch()}>다시 조회</button></p> :
      <ul className="member-list">{members.data.map((member) => <li key={member.user_id}>
        <div><strong>{member.display_name}</strong> <span>{member.role}</span></div>
        {isOwner && member.role !== "owner" && <MemberRole client={client} workspaceId={workspaceId} member={member} />}
      </li>)}</ul>}
    <p>Owner·Member는 이슈를 작성하고 Viewer는 조회합니다. 초대와 역할 변경은 Owner만 가능합니다. Owner 이전·자가 강등은 지원하지 않습니다.</p>
    <p>검증·댓글은 Owner·Member 권한으로 예정되어 있으며 해당 기능은 아직 제공하지 않습니다.</p>
    {isOwner && <InviteCreate client={client} workspaceId={workspaceId} />}
  </details>;
}
