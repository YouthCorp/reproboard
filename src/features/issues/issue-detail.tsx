"use client";

import { useEffect, useRef } from "react";
import { containDialogTab, restoreDialogFocus } from "@/lib/dialog-focus";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useMembers } from "@/features/workspaces/use-members";
import type { Issue } from "./commands";
import { PermissionIssueForm } from "./issue-form";
import { IssueHistory } from "./issue-history";
import { Comments } from "@/features/comments/comments";
import { useIssueRequest } from "./issue-commands";
import { displayedStatus } from "./command-store";
import { ConnectionHint } from "./issue-realtime";
import { boardColumns, completeness, priorities, priorityHelp, reproductions, severities, severityHelp, textFields } from "./fields";

export function IssueDetail({ client, workspaceId, issue, canWrite, loading, error, refreshing, retry, close }: {
  client: AppSupabase; workspaceId: string; issue?: Issue; canWrite: boolean;
  loading: boolean; error: boolean; refreshing: boolean; retry: () => void; close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const members = useMembers(client, workspaceId);
  const pending = useIssueRequest(workspaceId, issue?.id);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const originId = previous?.closest<HTMLElement>("[data-issue-id]")?.dataset.issueId;
    element.showModal();
    element.querySelector<HTMLButtonElement>("[data-detail-close]")?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close(); document.body.style.overflow = oldOverflow;
      restoreDialogFocus(previous, () => (originId ? document.querySelector<HTMLElement>(`[data-issue-id="${CSS.escape(originId)}"] .issue-card-link`) : null) ?? document.getElementById("inbox-title"));
    };
  }, []);
  const fulfilled = issue ? completeness(issue) : null;
  const assignee = members.data?.find((member) => member.user_id === issue?.assignee_id);
  return <dialog ref={dialog} className="issue-detail" aria-labelledby="detail-title" onKeyDown={containDialogTab} onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className="detail-toolbar"><span className="issue-key">{issue?.issue_key ?? "버그 상세"} · {boardColumns.find((c) => c.id === (issue ? displayedStatus(issue, canWrite ? pending : undefined) : ""))?.name ?? "조회 중"}</span>
      <div className="detail-toolbar-actions"><button type="button" className="button button-secondary" onClick={retry}>최신 상세 조회</button><button type="button" className="button button-secondary" onClick={close} data-detail-close>상세 닫기</button></div></div>
    <h2 id="detail-title">{issue?.title ?? "버그 상세"}</h2>
    <ConnectionHint />
    {pending && <p role="status">{pending.phase === "pending" ? "저장 중…" : "결과 확인 중 · 보드 카드에서 같은 요청으로 확인할 수 있습니다."} 저장 결과를 확인한 뒤 이 버그를 다시 수정할 수 있습니다.</p>}
    <span className="detail-refresh" role="status">{refreshing ? "최신 내용 확인 중…" : ""}</span>
    {error && <p role="alert">최신 버그를 불러오지 못했어요. 다시 시도해 주세요. {issue ? "마지막 조회 값과 입력을 유지했습니다." : "다시 조회해 주세요."}</p>}
    {loading ? <p role="status">버그를 불러오는 중…</p> : !issue && !error ? <p role="alert">버그가 없거나 볼 수 없는 팀입니다. 팀과 주소를 확인해 주세요.</p> : null}
    {issue && <>
      {(!canWrite || issue.status === "done") && <div className="completeness"><strong>저장된 재현 정보 {fulfilled!.count}/4 충족</strong><p>{fulfilled!.missing.length ? `누락: ${fulfilled!.missing.join(" · ")}` : "재현 정보 4개를 모두 입력했습니다."}</p></div>}
      {issue.assignee_id && assignee?.role === "viewer" && <p role="alert">담당자 재지정 필요: 기존 담당자가 읽기 전용으로 변경됐습니다.</p>}
      <PermissionIssueForm key={issue.id} client={client} workspaceId={workspaceId} issue={issue} canWrite={canWrite} />
      {!canWrite && <p className="read-only-note">읽기 전용입니다. 버그 내용을 확인할 수 있습니다.</p>}
      {(!canWrite || issue.status === "done") && <details className="saved-issue-fields" open>
        <summary>저장된 이슈 내용</summary>
        <dl className="issue-read-view">
          {textFields.slice(1).map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{issue[field.key] || "미입력"}</dd></div>)}
          <div><dt>재현 상태</dt><dd>{reproductions[issue.reproduction as keyof typeof reproductions]}</dd></div>
          <div><dt>심각도</dt><dd>{severities[issue.severity as keyof typeof severities]}<p className="form-hint">{severityHelp}</p></dd></div>
          <div><dt>우선순위</dt><dd>{priorities[issue.priority as keyof typeof priorities]}<p className="form-hint">{priorityHelp}</p></dd></div>
          <div><dt>담당자</dt><dd>{issue.assignee_id ? assignee?.display_name ?? "담당자 확인 필요" : "미지정"}</dd></div>
        </dl>
      </details>}
      <IssueHistory client={client} workspaceId={workspaceId} issueId={issue.id} />
      <Comments client={client} workspaceId={workspaceId} issueId={issue.id} canWrite={canWrite} />
    </>}
  </dialog>;
}
