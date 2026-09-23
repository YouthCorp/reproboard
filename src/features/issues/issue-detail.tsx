"use client";

import { useEffect, useRef } from "react";
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
    element.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = oldOverflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  const fulfilled = issue ? completeness(issue) : null;
  const assignee = members.data?.find((member) => member.user_id === issue?.assignee_id);
  return <dialog ref={dialog} className="issue-detail" aria-labelledby="detail-title" onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className="detail-toolbar"><span className="issue-key">{issue?.issue_key ?? "이슈 상세"} · {boardColumns.find((c) => c.id === (issue ? displayedStatus(issue, canWrite ? pending : undefined) : ""))?.name ?? "조회 중"}</span>
      <button type="button" className="button button-secondary" onClick={close} autoFocus>상세 닫기</button></div>
    <h2 id="detail-title">{issue?.title ?? "이슈 상세"}</h2>
    <ConnectionHint />
    {pending && <p role="status">{pending.phase === "pending" ? "저장 중…" : "결과 확인 중 · 보드 카드에서 같은 요청으로 확인할 수 있습니다."} 이 이슈의 추가 변경은 결과 확인 후 가능합니다.</p>}
    <div className="detail-refresh"><button type="button" className="button button-secondary" onClick={retry}>최신 상세 조회</button><span role="status">{refreshing ? "서버 확인 중…" : ""}</span></div>
    {error && <p role="alert">최신 이슈를 불러오지 못했습니다. {issue ? "마지막 조회 값과 입력을 유지했습니다." : "다시 조회해 주세요."}</p>}
    {loading ? <p role="status">이슈를 불러오는 중…</p> : !issue && !error ? <p role="alert">이슈가 없거나 접근 권한이 없습니다. 팀과 주소를 확인하세요.</p> : null}
    {issue && <>
      <div className="completeness"><strong>저장된 재현 정보 {fulfilled!.count}/4 충족</strong><p>{fulfilled!.missing.length ? `누락: ${fulfilled!.missing.join(" · ")}` : "재현 정보 4개를 모두 입력했습니다."}</p></div>
      {issue.assignee_id && assignee?.role === "viewer" && <p role="alert">담당자 재지정 필요: 기존 담당자가 Viewer로 변경됐습니다.</p>}
      <PermissionIssueForm key={issue.id} client={client} workspaceId={workspaceId} issue={issue} canWrite={canWrite} />
      {!canWrite && <p className="read-only-note">Viewer는 조회만 할 수 있습니다.</p>}
      {(!canWrite || issue.status === "done") && <details className="saved-issue-fields" open={issue.status !== "done"}>
        <summary>저장된 이슈 내용</summary>
        <dl className="issue-read-view">
          {textFields.slice(1).map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{issue[field.key] || "미입력"}</dd></div>)}
          <div><dt>재현 상태</dt><dd>{reproductions[issue.reproduction as keyof typeof reproductions]}</dd></div>
          <div><dt>심각도 (severity)</dt><dd>{severities[issue.severity as keyof typeof severities]}<p className="form-hint">{severityHelp}</p></dd></div>
          <div><dt>우선순위 (priority)</dt><dd>{priorities[issue.priority as keyof typeof priorities]}<p className="form-hint">{priorityHelp}</p></dd></div>
          <div><dt>담당자</dt><dd>{issue.assignee_id ? assignee?.display_name ?? "담당자 확인 필요" : "미지정"}</dd></div>
        </dl>
      </details>}
      <IssueHistory client={client} workspaceId={workspaceId} issueId={issue.id} />
      <Comments client={client} workspaceId={workspaceId} issueId={issue.id} canWrite={canWrite} />
    </>}
  </dialog>;
}
