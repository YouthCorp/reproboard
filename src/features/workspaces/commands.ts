import type { AppSupabase } from "@/lib/supabase/browser";
import type { Json } from "@/lib/supabase/database.types";

export type WorkspaceCommand = {
  operation: "create_workspace" | "create_invite" | "change_member_role";
  workspaceId: string; requestId: string; payload: Record<string, Json>;
} | { operation: "accept_invite"; requestId: string; token: string };
export type WorkspaceResult = {
  ok: true; requestId: string; data: { workspaceId: string; inviteId?: string; expiresAt?: string };
} | { ok: false; code: string; message: string };

export async function executeWorkspaceCommand(client: AppSupabase, command: WorkspaceCommand): Promise<WorkspaceResult> {
  if (!navigator.onLine) throw new Error("OFFLINE");
  const response = command.operation === "accept_invite"
    ? await client.rpc("accept_invite", { p_request_id: command.requestId, p_token: command.token })
    : await client.rpc(command.operation, { p_workspace_id: command.workspaceId, p_request_id: command.requestId, p_payload: command.payload });
  if (response.error || !response.data || typeof response.data !== "object" || Array.isArray(response.data)
    || typeof response.data.ok !== "boolean") throw new Error("UNKNOWN_RESULT");
  return response.data as WorkspaceResult;
}

export function newInviteToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
