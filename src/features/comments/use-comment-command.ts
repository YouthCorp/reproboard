"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useConnection } from "@/features/issues/issue-realtime";
import { executeCommentCommand, type CommentCommand } from "./commands";

export function useCommentCommand(client: AppSupabase) {
  const cache = useQueryClient(), connection = useConnection();
  const [unconfirmed, setUnconfirmed] = useState<CommentCommand | null>(null);
  const [message, setMessage] = useState("");
  const busy = useRef(false), active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const mutation = useMutation({ mutationFn: (command: CommentCommand) => executeCommentCommand(client, command), retry: false, networkMode: "always" });
  async function run(command: CommentCommand) {
    if (busy.current) return false;
    busy.current = true; setMessage("");
    const request = unconfirmed ?? command;
    try {
      const result = await mutation.mutateAsync(request);
      if (!active.current) return false;
      connection?.reportHttp(true); setUnconfirmed(null);
      setMessage(result.ok ? (request.operation === "add" ? "댓글을 저장했습니다." : "읽음으로 표시했습니다.") : result.message ?? "저장하지 못했습니다.");
      // Invalidation failure never turns a confirmed commit back into an uncertain command.
      for (const key of ["comments", "activity", "notifications", "membership"]) void cache.invalidateQueries({ queryKey: [key, request.workspaceId] });
      return result.ok;
    } catch (error) {
      if (!active.current) return false;
      const offline = error instanceof Error && error.message === "OFFLINE";
      if (!offline) { setUnconfirmed(request); connection?.reportHttp(false); }
      setMessage(offline ? "오프라인이라 보내지 않았습니다. 연결 후 직접 저장하세요." : "결과 확인 중 · 같은 요청으로 확인하세요. 입력은 유지됩니다.");
      return false;
    } finally { busy.current = false; }
  }
  return { run, pending: mutation.isPending, unconfirmed, message, setMessage };
}
