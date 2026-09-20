"use client";

import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useMembers } from "@/features/workspaces/use-members";
import { executeIssueCommand, type Issue, type IssueCommand } from "./commands";
import { completeness, issueValues, normalized, priorities, priorityHelp, reproductions, severities, severityHelp, textFields, validateFields, type FieldErrors, type IssueValues } from "./fields";

export function IssueForm({ client, workspaceId, issue }: { client: AppSupabase; workspaceId: string; issue?: Issue }) {
  const id = useId();
  const cache = useQueryClient();
  const members = useMembers(client, workspaceId);
  const form = useRef<HTMLFormElement>(null);
  const composing = useRef(false);
  // Local draft with its own base version, never another server-data cache.
  const [draft, setDraft] = useState(() => issueValues(issue));
  const [baseVersion, setBaseVersion] = useState(issue?.version);
  const [expanded, setExpanded] = useState(!!issue);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [unconfirmed, setUnconfirmed] = useState<IssueCommand | null>(null);
  const [message, setMessage] = useState("");
  const mutation = useMutation({ mutationFn: (command: IssueCommand) => executeIssueCommand(client, command), retry: false, networkMode: "always" });
  const stale = !!issue && baseVersion !== issue.version;
  const locked = mutation.isPending || !!unconfirmed;
  const fulfilled = completeness(draft);
  function change(key: keyof IssueValues, value: string | null) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }
  function focusField(key: string) {
    requestAnimationFrame(() => (form.current?.elements.namedItem(key) as HTMLElement | null)?.focus());
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || composing.current) return;
    const validation = validateFields(draft, members.data ?? [], issue?.assignee_id);
    if (!unconfirmed && Object.keys(validation).length) {
      setErrors(validation); setExpanded(true); setMessage("입력 오류를 확인하세요.");
      focusField(Object.keys(validation)[0]); return;
    }
    const command = unconfirmed ?? { operation: issue ? "update" : "create", workspaceId, issueId: issue?.id,
      expectedVersion: baseVersion, requestId: crypto.randomUUID(), payload: normalized(draft) } satisfies IssueCommand;
    setMessage("");
    try {
      const result = await mutation.mutateAsync(command);
      setUnconfirmed(null);
      if (!result.ok) {
        setMessage(result.message);
        if (["CONFLICT", "FORBIDDEN", "NOT_FOUND"].includes(result.code)) {
          await Promise.all([cache.invalidateQueries({ queryKey: ["issues", workspaceId] }), cache.invalidateQueries({ queryKey: ["membership", workspaceId] }), cache.invalidateQueries({ queryKey: ["members", workspaceId] })]);
        }
        requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(".form-message")?.focus());
        return;
      }
      setDraft(issue ? issueValues(result.data) : issueValues()); setBaseVersion(issue ? result.data.version : undefined);
      setErrors({}); setMessage(`${result.data.issue_key} 저장했습니다.`);
      // A receipt can describe an older success; fetch the current server row.
      await cache.invalidateQueries({ queryKey: ["issues", workspaceId] });
    } catch {
      setUnconfirmed(command);
      setMessage("저장 결과를 확인하지 못했습니다. 입력과 요청을 보존했습니다. 연결 후 같은 요청으로 다시 확인하세요.");
    }
  }
  function textControl(field: (typeof textFields)[number]) {
    const label = field.key === "title" ? issue ? "이슈 제목" : "새 이슈 제목" : field.label;
    const props = { id: `${id}-${field.key}`, name: field.key, value: draft[field.key], "aria-invalid": !!errors[field.key],
      "aria-describedby": `${id}-${field.key}-hint${errors[field.key] ? ` ${id}-${field.key}-error` : ""}`,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(field.key, event.target.value) };
    return <div className="issue-field" key={field.key}>
      <label htmlFor={props.id}>{label}</label>
      {field.key === "title" || field.key === "target_build" ? <input {...props} required={field.key === "title"} /> : <textarea {...props} rows={field.key === "steps" ? 4 : 3} />}
      <p className="form-hint" id={`${id}-${field.key}-hint`}>{field.key === "title" && "필수 · "}{Array.from(draft[field.key].trim()).length.toLocaleString("ko-KR")} / {field.max.toLocaleString("ko-KR")}자 · 앞뒤 공백 제외{field.key === "reproduction_note" ? " · 간헐적 재현이면 필수" : ""}</p>
      {errors[field.key] && <p className="field-error" id={`${id}-${field.key}-error`}>{errors[field.key]}</p>}
    </div>;
  }
  function selectControl(key: "reproduction" | "severity" | "priority", label: string, options: Record<string, string>, help: string) {
    return <div className="issue-field"><label htmlFor={`${id}-${key}`}>{label}</label>
      <select id={`${id}-${key}`} name={key} value={draft[key]} onChange={(event) => change(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={`${id}-${key}-hint`}>
        {Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select><p className="form-hint" id={`${id}-${key}-hint`}>{errors[key] || help}</p></div>;
  }
  return <form ref={form} className={issue ? "issue-edit-form" : `issue-create-form${expanded ? "" : " compact-create"}`} onSubmit={submit} noValidate
    onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
    onKeyDown={(event) => { if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }}>
    <fieldset disabled={locked}>
      <legend className="sr-only">{issue ? "이슈 편집" : "Inbox 이슈 등록"}</legend>
      {textControl(textFields[0])}
      {!issue && <button className="disclosure-button" type="button" aria-expanded={expanded} aria-controls={`${id}-fields`} onClick={() => setExpanded(!expanded)}>{expanded ? "추가 필드 접기" : "추가 필드 입력 (선택)"}</button>}
      <div id={`${id}-fields`} hidden={!expanded}>
        <div className="completeness" aria-live="polite"><strong>작성 중인 재현 정보 {fulfilled.count}/4 충족</strong><p>{fulfilled.missing.length ? `누락: ${fulfilled.missing.join(" · ")}` : "재현 단계·기대 결과·실제 결과·환경을 모두 입력했습니다."}</p></div>
        {textFields.slice(1, 5).map(textControl)}
        {selectControl("reproduction", "재현 상태", reproductions, "직접 확인한 재현 결과를 선택하세요. 입력 충족 수와는 별개입니다.")}
        {textControl(textFields[5])}
        <div className="field-pair">{selectControl("severity", "심각도 (severity)", severities, severityHelp)}{selectControl("priority", "우선순위 (priority)", priorities, priorityHelp)}</div>
        <div className="issue-field"><label htmlFor={`${id}-assignee_id`}>담당자</label>
          <select id={`${id}-assignee_id`} name="assignee_id" value={draft.assignee_id ?? ""} onChange={(event) => change("assignee_id", event.target.value || null)} aria-invalid={!!errors.assignee_id} aria-describedby={`${id}-assignee-hint`}>
            <option value="">미지정</option>
            {draft.assignee_id && !members.data?.some((m) => m.user_id === draft.assignee_id && m.role !== "viewer") && <option value={draft.assignee_id} disabled>기존 담당자 · 권한 확인 또는 재지정 필요</option>}
            {members.data?.filter((m) => m.role === "owner" || m.role === "member").map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name} · {m.role}</option>)}
          </select><p id={`${id}-assignee-hint`} className={errors.assignee_id ? "field-error" : "form-hint"}>{errors.assignee_id || "같은 팀의 Owner 또는 Member만 새로 지정할 수 있습니다."}</p>
          {members.isPending && <p role="status">담당자 목록을 불러오는 중…</p>}
          {members.isError && <p role="alert">담당자를 불러오지 못했습니다. <button type="button" onClick={() => members.refetch()}>담당자 다시 조회</button></p>}
        </div>
        <p className="form-hint">수정 메모·대상 빌드는 선택 입력입니다. Verify 진입 시 필수이며 상태 이동은 다음 단계에서 제공됩니다.</p>
        {textFields.slice(6).map(textControl)}
      </div>
    </fieldset>
    {stale && <div className="stale-draft" role="alert"><p>다른 변경이 있습니다. 작성 중인 입력은 유지했습니다.</p>
      <p>현재 서버 제목: {issue.title}</p><p>최신 값을 불러오면 이 폼의 작성 중인 내용을 교체합니다.</p>
      <button type="button" className="button button-secondary" disabled={locked} onClick={() => { setDraft(issueValues(issue)); setBaseVersion(issue.version); setErrors({}); setMessage(""); }}>최신 값으로 다시 편집</button></div>}
    <div className="form-actions"><button className="button button-primary" type="submit" disabled={mutation.isPending || (stale && !unconfirmed)}>{mutation.isPending ? "저장 중…" : unconfirmed ? "같은 요청으로 다시 확인" : issue ? "변경 저장" : "Inbox에 생성"}</button>
      <span className="form-hint">{issue ? "저장 전 입력은 이 폼에만 유지됩니다." : "제목만 입력해도 Inbox에 등록할 수 있습니다."}</span></div>
    <p className="form-message" role="status" tabIndex={-1}>{message}</p>
  </form>;
}
