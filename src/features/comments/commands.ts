import type { AppSupabase } from "@/lib/supabase/browser";

export type CommentCommand = { operation: "add"; workspaceId: string; issueId: string; requestId: string; body: string; mentions: string[] }
  | { operation: "read"; workspaceId: string; notificationId: string; requestId: string };
export function validateComment(body: string, mentions: string[]) {
  const length = Array.from(body.trim()).length;
  return length < 1 || length > 4000 ? "댓글은 공백 제거 후 1~4,000자입니다."
    : new Set(mentions).size > 8 ? "멘션은 최대 8명입니다." : "";
}
export async function executeCommentCommand(client: AppSupabase, command: CommentCommand) {
  if (!navigator.onLine) throw new Error("OFFLINE");
  const result = command.operation === "add"
    ? await client.rpc("add_comment", { p_workspace_id: command.workspaceId, p_issue_id: command.issueId, p_request_id: command.requestId,
      p_payload: { body: command.body, mention_ids: command.mentions } }).retry(false)
    : await client.rpc("mark_notification_read", { p_workspace_id: command.workspaceId, p_notification_id: command.notificationId, p_request_id: command.requestId }).retry(false);
  if (result.error || !result.data || typeof result.data !== "object" || Array.isArray(result.data) || typeof result.data.ok !== "boolean") throw new Error("UNKNOWN_RESULT");
  return result.data as { ok: boolean; message?: string };
}
