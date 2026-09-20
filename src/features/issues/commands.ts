import type { AppSupabase } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";
import type { IssueValues } from "./fields";

export type Issue = Database["public"]["Tables"]["issues"]["Row"];
export type IssueCommand = {
  operation: "create" | "update"; workspaceId: string; requestId: string; payload: IssueValues;
  issueId?: string; expectedVersion?: number;
};
export type CommandResult = { ok: true; data: Issue; requestId: string }
  | { ok: false; code: "CONFLICT" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND"; message: string };

export async function executeIssueCommand(client: AppSupabase, command: IssueCommand): Promise<CommandResult> {
  if (!navigator.onLine) throw new Error("OFFLINE");
  const args = { p_workspace_id: command.workspaceId, p_request_id: command.requestId, p_payload: command.payload };
  const response = command.operation === "create"
    ? await client.rpc("create_issue", args)
    : await client.rpc("update_issue", { ...args, p_issue_id: command.issueId!, p_expected_version: command.expectedVersion! });
  // SDK/transport errors are distinct from a DB domain rejection. Keep requestId for explicit retry.
  if (response.error) throw new Error("UNKNOWN_RESULT");
  const data = response.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.ok !== "boolean") throw new Error("UNKNOWN_RESULT");
  return data as CommandResult;
}
