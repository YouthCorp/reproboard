"use client";
import { useQuery } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useConnection } from "@/features/issues/issue-realtime";
import { useCommentCommand } from "./use-comment-command";

export function Notifications({ client, workspaceId, userId, selectIssue }: { client: AppSupabase; workspaceId: string; userId: string; selectIssue: (id: string) => void }) {
  const command = useCommentCommand(client), connection = useConnection();
  const notifications = useQuery({ queryKey: ["notifications", workspaceId, userId], queryFn: async ({ signal }) => {
    const rows = [];
    for (let offset = 0; ; offset += 200) {
      const result = await client.from("notifications").select("id,read_at,created_at,comments!inner(issue_id,body)").eq("workspace_id", workspaceId).eq("recipient_id", userId)
        .order("created_at").order("id").range(offset, offset + 199).abortSignal(signal).retry(false);
      if (result.error) throw new Error("알림을 불러오지 못했습니다."); rows.push(...result.data);
      if (result.data.length < 200) return rows.reverse();
    }
  } });
  return <details className="notifications"><summary>내 알림 · {notifications.data?.filter((n) => !n.read_at).length ?? "…"}건 안 읽음</summary>
    <p className="form-hint">이 팀에서 나를 선택해 알림을 보낸 댓글입니다. 내가 나를 선택한 댓글은 제외됩니다.</p>
    {notifications.isPending && <p role="status">알림을 불러오는 중…</p>}
    {notifications.isError && <p role="alert">알림을 불러오지 못했습니다. <button onClick={() => notifications.refetch()}>알림 다시 조회</button></p>}
    {notifications.data?.length === 0 && <p>아직 알림이 없습니다.</p>}
    <ul>{notifications.data?.map((notification) => <li key={notification.id}>
      <span>{notification.read_at ? "읽음" : "안 읽음"} · </span><button className="notification-link" onClick={() => selectIssue(notification.comments.issue_id)}>{notification.comments.body}</button>
      {!notification.read_at && <button className="button button-secondary" disabled={command.pending || !!command.unconfirmed || connection?.online === false}
        onClick={() => command.run({ operation: "read", workspaceId, notificationId: notification.id, requestId: crypto.randomUUID() })}>읽음으로 표시</button>}
    </li>)}</ul>
    {command.message && <p role="status">{command.message}</p>}
    {command.unconfirmed && <button disabled={command.pending || connection?.online === false} onClick={() => command.run(command.unconfirmed!)}>같은 읽음 요청 확인</button>}
  </details>;
}
