import type { AppSupabase } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";

export type Issue = Database["public"]["Tables"]["issues"]["Row"];
export type IssueCommand = {
  operation: "create" | "update"; workspaceId: string; requestId: string; title: string;
  issueId?: string; expectedVersion?: number;
};
export type CommandResult = { ok: true; data: Issue; requestId: string }
  | { ok: false; code: "CONFLICT" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND"; message: string };

export function titleError(value: string) {
  const length = Array.from(value.trim()).length;
  return length < 1 || length > 120 ? "제목은 공백 제거 후 1~120자여야 합니다." : "";
}

export async function executeIssueCommand(client: AppSupabase, command: IssueCommand): Promise<CommandResult> {
  if (!navigator.onLine) throw new Error("OFFLINE");
  const args = { p_workspace_id: command.workspaceId, p_request_id: command.requestId, p_payload: { title: command.title } };
  const response = command.operation === "create"
    ? await client.rpc("create_issue", args)
    : await client.rpc("update_issue", { ...args, p_issue_id: command.issueId!, p_expected_version: command.expectedVersion! });
  // SDK/transport errors are distinct from a DB domain rejection. Keep requestId for explicit retry.
  if (response.error) throw new Error("UNKNOWN_RESULT");
  const data = response.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.ok !== "boolean") throw new Error("UNKNOWN_RESULT");
  return data as CommandResult;
}
