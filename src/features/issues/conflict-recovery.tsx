"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Issue } from "./commands";
import { boardColumns, issueValues, priorities, reproductions, severities, textFields, type IssueValues, type Member } from "./fields";

export function ConflictRecovery({ issue, draft, members, locked, newer, restart }: {
  issue: Issue; draft: IssueValues; members: Member[]; locked: boolean; newer: boolean; restart: () => void;
}) {
  const cache = useQueryClient();
  const [show, setShow] = useState(false);
  const [copy, setCopy] = useState("");
  const [fallback, setFallback] = useState("");
  const [readError, setReadError] = useState(false);
  const fields = [...textFields, { key: "reproduction", label: "재현 상태" }, { key: "severity", label: "심각도" }, { key: "priority", label: "우선순위" }, { key: "assignee_id", label: "담당자" }] as const;
  const saved = issueValues(issue);
  function value(key: keyof IssueValues, values: IssueValues) {
    const raw = values[key];
    if (key === "assignee_id") return members.find((m) => m.user_id === raw)?.display_name ?? (raw ? "담당자 확인 필요" : "미지정");
    const labels: Record<string, string> = key === "reproduction" ? reproductions : key === "severity" ? severities : key === "priority" ? priorities : {};
    return labels[raw ?? ""] ?? raw ?? "";
  }
  async function copyDraft() {
    const text = fields.map(({ key, label }) => `${label}: ${value(key, draft)}`).join("\n\n");
    try { await navigator.clipboard.writeText(text); setCopy("내 입력을 복사했습니다."); setFallback(""); }
    catch { setCopy("클립보드에 접근할 수 없습니다. 아래 입력을 선택해 직접 복사하세요."); setFallback(text); }
  }
  return <section className="stale-draft" aria-label="충돌 복구">
    <p role="alert">다른 팀원이 먼저 수정했어요. 작성 중인 내용은 그대로 남아 있습니다.</p>
    <p>먼저 저장된 제목: {issue.title}</p>
    <p>같은 버그를 함께 수정하면 먼저 저장한 내용이 반영됩니다. 다른 항목을 수정했더라도 최신 내용을 확인해 주세요.</p>
    <div className="form-actions">
      <button type="button" className="button button-secondary" onClick={async () => {
        setShow(true); setReadError(false);
        try { await cache.invalidateQueries({ queryKey: ["issues", issue.workspace_id] }, { throwOnError: true }); }
        catch { setReadError(true); }
      }}>최신 값 보기</button>
      <button type="button" className="button button-secondary" onClick={copyDraft}>내 입력 복사</button>
    </div>
    {show && <div className="conflict-comparison">
      <p>마지막 조회한 서버 값과 내 입력입니다. 서버 상태: {boardColumns.find((c) => c.id === issue.status)?.name}</p>
      {readError && <p role="alert">최신 조회에 실패했습니다. 마지막 조회 값을 표시합니다.</p>}
      <table><caption>최신 내용과 내 입력 비교</caption><thead><tr><th scope="col">필드</th><th scope="col">서버 값</th><th scope="col">내 입력</th></tr></thead>
        <tbody>{fields.map(({ key, label }) => <tr key={key}><th scope="row">{label}</th><td>{value(key, saved) || "미입력"}</td><td>{value(key, draft) || "미입력"}</td></tr>)}</tbody>
      </table>
    </div>}
    <p role="status">{copy}</p>
    {fallback && <label>복사할 내 입력<textarea readOnly value={fallback} rows={8} onFocus={(event) => event.target.select()} /></label>}
    <p>‘최신 값으로 다시 편집’을 누르면 작성 중인 내용이 바뀝니다. 필요한 입력을 먼저 복사한 뒤 다시 편집하고 저장해 주세요.</p>
    <button type="button" className="button button-secondary" disabled={locked || !newer || issue.status === "done" || readError} onClick={restart}>최신 값으로 다시 편집</button>
    {issue.status === "done" && <p>완료의 본문은 재오픈 후 다시 편집할 수 있습니다. 보존한 입력을 복사할 수 있습니다.</p>}
  </section>;
}
