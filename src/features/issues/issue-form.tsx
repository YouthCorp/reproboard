"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { executeIssueCommand, titleError, type Issue, type IssueCommand } from "./commands";

export function IssueForm({ client, workspaceId, issue }: { client: AppSupabase; workspaceId: string; issue?: Issue }) {
  const id = useId();
  const cache = useQueryClient();
  const [draft, setDraft] = useState(issue?.title ?? "");
  const [baseVersion, setBaseVersion] = useState(issue?.version);
  const [unconfirmed, setUnconfirmed] = useState<IssueCommand | null>(null);
  const [message, setMessage] = useState("");
  const mutation = useMutation({ mutationFn: (command: IssueCommand) => executeIssueCommand(client, command), retry: false, networkMode: "always" });
  const stale = issue && baseVersion !== issue.version;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const invalid = titleError(draft);
    if (invalid) { setMessage(invalid); return; }
    const command = unconfirmed ?? { operation: issue ? "update" : "create", workspaceId,
      issueId: issue?.id, expectedVersion: baseVersion, requestId: crypto.randomUUID(), title: draft } satisfies IssueCommand;
    setMessage("");
    try {
      const result = await mutation.mutateAsync(command);
      setUnconfirmed(null);
      if (!result.ok) {
        setMessage(result.message);
        if (result.code === "CONFLICT" || result.code === "FORBIDDEN" || result.code === "NOT_FOUND") {
          await cache.invalidateQueries({ queryKey: ["issues", workspaceId] });
          await cache.invalidateQueries({ queryKey: ["membership", workspaceId] });
        }
        return;
      }
      // Refetch the authoritative list. A replay may return an older saved receipt.
      // Never replace the cache with that potentially older result.
      setDraft(issue ? result.data.title : "");
      setBaseVersion(issue ? result.data.version : undefined);
      setMessage(issue ? "제목을 저장했습니다." : "Inbox 이슈를 생성했습니다.");
      await cache.invalidateQueries({ queryKey: ["issues", workspaceId] });
    } catch (error) {
      setUnconfirmed(command);
      setMessage(error instanceof Error && error.message === "OFFLINE"
        ? "오프라인이라 요청을 보내지 않았습니다. 연결 후 직접 다시 시도하세요."
        : "저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인하세요.");
    }
  }
  return <form className={issue ? "issue-edit-form" : "issue-create-form"} onSubmit={submit}>
    <label htmlFor={id}>{issue ? `${issue.issue_key} 제목` : "새 이슈 제목"}</label>
    <div className="form-row">
      <input id={id} value={draft} onChange={(event) => { setDraft(event.target.value); setMessage(""); }}
        disabled={mutation.isPending || !!unconfirmed} aria-describedby={`${id}-hint ${id}-message`} />
      <button className="button button-primary" disabled={mutation.isPending || (!!stale && !unconfirmed)}>
        {mutation.isPending ? "저장 중…" : unconfirmed ? "같은 요청으로 다시 확인" : issue ? "제목 저장" : "Inbox에 생성"}
      </button>
    </div>
    <p className="form-hint" id={`${id}-hint`}>공백 제거 후 1~120자 · 결합 이모지는 여러 글자로 계산될 수 있습니다.</p>
    <p className="form-message" id={`${id}-message`} role="status" aria-live="polite">{message}</p>
    {stale && <div className="stale-draft">
      <p>다른 변경이 있습니다. 작성 중인 입력은 유지했습니다.</p>
      <p>현재 서버 제목: {issue.title}</p>
      <button type="button" className="button button-secondary" disabled={mutation.isPending || !!unconfirmed}
        onClick={() => { setDraft(issue.title); setBaseVersion(issue.version); setMessage(""); mutation.reset(); }}>최신 제목으로 다시 편집</button>
    </div>}
  </form>;
}
