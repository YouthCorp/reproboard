import type { AppSupabase } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";
import type { IssueValues } from "./fields";

export type Issue = Database["public"]["Tables"]["issues"]["Row"];
export type IssueCommand = {
  operation: "create" | "update"; workspaceId: string; requestId: string; payload: IssueValues;
  issueId?: string; expectedVersion?: number;
};
export type TransitionCommand = {
  operation: "transition"; workspaceId: string; issueId: string; expectedVersion: number; requestId: string;
  payload: { target_status: string; reason?: string; verification?: { tested_build: string; tested_environment: string; note: string } };
};
export type BoardCommand = IssueCommand | TransitionCommand;
export type CommandResult = { ok: true; data: Issue; requestId: string }
  | { ok: false; code: "CONFLICT" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND"; message: string };

export async function executeIssueCommand(client: AppSupabase, command: BoardCommand): Promise<CommandResult> {
  if (!navigator.onLine) throw new Error("OFFLINE");
  const args = { p_workspace_id: command.workspaceId, p_request_id: command.requestId, p_payload: command.payload };
  const request = command.operation === "create"
    ? client.rpc("create_issue", args)
    : client.rpc(command.operation === "transition" ? "transition_issue" : "update_issue", { ...args, p_issue_id: command.issueId!, p_expected_version: command.expectedVersion! });
  // A timeout only means the response is unknown; the database may already have committed.
  const response = await request.abortSignal(AbortSignal.timeout(10_000));
  // SDK/transport errors are distinct from a DB domain rejection. Keep requestId for explicit retry.
  if (response.error) throw new Error("UNKNOWN_RESULT");
  const data = response.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.ok !== "boolean") throw new Error("UNKNOWN_RESULT");
  return data as CommandResult;
}
