"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useWorkspaceCommand } from "./use-workspace-command";

export function WorkspaceCreate({ client }: { client: AppSupabase }) {
  const [name, setName] = useState("");
  const command = useWorkspaceCommand(client);
  const router = useRouter();
  return <details className="team-panel">
    <summary>새 워크스페이스 만들기</summary>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (command.pending) return;
      if (Array.from(name.trim()).length < 1 || Array.from(name.trim()).length > 80) { command.setMessage("팀 이름은 1~80자여야 합니다."); return; }
      const result = await command.run(command.unconfirmed ?? { operation: "create_workspace", workspaceId: crypto.randomUUID(), requestId: crypto.randomUUID(), payload: { name } });
      if (result) { setName(""); command.setMessage("워크스페이스를 만들었습니다. 생성자는 Owner입니다."); router.push(`/board?workspace=${result.data.workspaceId}`); }
    }}>
      <label htmlFor="new-workspace-name">새 워크스페이스 이름</label>
      <div className="form-row"><input id="new-workspace-name" value={name} onChange={(event) => setName(event.target.value)} disabled={command.pending || !!command.unconfirmed} />
        <button className="button button-primary" disabled={command.pending}>{command.pending ? "생성 중…" : command.unconfirmed ? "같은 요청으로 다시 확인" : "워크스페이스 생성"}</button></div>
      <p role="status">{command.message}</p>
    </form>
  </details>;
}
