"use client";

import { useState } from "react";
import { useMembers } from "./use-members";
import type { AppSupabase } from "@/lib/supabase/browser";
import { newInviteToken } from "./commands";
import { useWorkspaceCommand } from "./use-workspace-command";
import { roleLabels } from "./role-labels";

function MemberRole({ client, workspaceId, member }: { client: AppSupabase; workspaceId: string; member: { user_id: string; role: string; display_name: string } }) {
  const command = useWorkspaceCommand(client);
  return <>
    <button className="button button-secondary" disabled={command.pending} onClick={async () => {
      const result = await command.run(command.unconfirmed ?? { operation: "change_member_role", workspaceId, requestId: crypto.randomUUID(),
        payload: { userId: member.user_id, expectedRole: member.role, role: member.role === "member" ? "viewer" : "member" } });
      if (result) command.setMessage("역할을 저장했습니다.");
    }}>{command.pending ? "변경 중…" : command.unconfirmed ? "같은 요청으로 다시 확인" : `${member.display_name} → ${member.role === "member" ? "읽기 전용" : "멤버"}`}</button>
    <p role="status">{command.message}</p>
  </>;
}

function InviteCreate({ client, workspaceId }: { client: AppSupabase; workspaceId: string }) {
  const command = useWorkspaceCommand(client);
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  return <div className="invite-create">
    <p>로그인한 한 사람만 멤버로 참여할 수 있습니다. 초대 링크는 24시간 동안 유효합니다.</p>
    <button className="button button-primary" disabled={command.pending} onClick={async () => {
      const token = command.unconfirmed?.operation === "create_invite" ? String(command.unconfirmed.payload.token) : newInviteToken();
      const result = await command.run({ operation: "create_invite", workspaceId, requestId: crypto.randomUUID(), payload: { token } });
      if (result) { setLink(`${window.location.origin}/invite#${token}`); setExpiresAt(result.data.expiresAt ?? ""); }
    }}>{command.pending ? "생성 중…" : command.unconfirmed ? "같은 요청으로 다시 확인" : "멤버 초대 링크 만들기"}</button>
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
  const members = useMembers(client, workspaceId);
  return <details className="team-panel"><summary>팀 관리</summary>
    {members.isPending ? <p role="status">멤버를 불러오는 중…</p> : members.isError ? <p role="alert">팀 멤버를 불러오지 못했습니다. <button onClick={() => members.refetch()}>다시 조회</button></p> :
      <ul className="member-list">{members.data.map((member) => <li key={member.user_id}>
        <div><strong>{member.display_name}</strong> <span>{roleLabels[member.role]}</span></div>
        {isOwner && member.role !== "owner" && <MemberRole client={client} workspaceId={workspaceId} member={member} />}
      </li>)}</ul>}
    <p>관리자와 멤버는 버그 작성·재검증·댓글을 사용할 수 있습니다. 읽기 전용 멤버는 내용을 확인할 수 있습니다. 초대와 역할 변경은 관리자만 할 수 있으며, 관리자 역할은 다른 사람에게 넘길 수 없습니다.</p>
    {isOwner && <InviteCreate client={client} workspaceId={workspaceId} />}
  </details>;
}
