"use client";

import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useMembers } from "@/features/workspaces/use-members";
import { roleLabels } from "@/features/workspaces/role-labels";
import { type Issue, type IssueCommand } from "./commands";
import { completeness, issueValues, normalized, priorities, priorityHelp, reproductions, severities, severityHelp, textFields, validateFields, type FieldErrors, type IssueValues } from "./fields";
import { stateFieldErrors } from "./state-rules";
import { TransitionMenu } from "./transition-menu";
import { useIssueCommands, useIssueRequest } from "./issue-commands";
import { ConflictRecovery } from "./conflict-recovery";
import { useConnection } from "./issue-realtime";

type FormProps = { client: AppSupabase; workspaceId: string; issue?: Issue; canWrite?: boolean };
// A role downgrade preserves an already-open draft; initial Viewers get only the read view.
export function PermissionIssueForm(props: FormProps & { canWrite: boolean }) {
  const [retained, setRetained] = useState(props.canWrite);
  if (props.canWrite && !retained) setRetained(true);
  return retained ? <IssueForm {...props} /> : null;
}

export function IssueForm({ client, workspaceId, issue, canWrite = true }: FormProps) {
  const id = useId();
  const cache = useQueryClient();
  const commands = useIssueCommands();
  const connection = useConnection();
  const sharedRequest = useIssueRequest(workspaceId, issue?.id);
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
  const [conflict, setConflict] = useState(false);
  const mutation = useMutation({ mutationFn: (command: IssueCommand) => commands.run(command), retry: false, networkMode: "always" });
  const stale = !!issue && baseVersion !== issue.version;
  const locked = mutation.isPending || !!unconfirmed || !!sharedRequest;
  const done = issue?.status === "done";
  const dirty = JSON.stringify(normalized(draft)) !== JSON.stringify(issueValues(issue));
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
    if (!canWrite || mutation.isPending || composing.current || done || (sharedRequest && sharedRequest.command.requestId !== unconfirmed?.requestId)) return;
    const assigneeValid = !!draft.assignee_id && !!members.data?.some((m) => m.user_id === draft.assignee_id && (m.role === "owner" || m.role === "member"));
    const validation = { ...validateFields(draft, members.data ?? [], issue?.assignee_id), ...stateFieldErrors(issue?.status ?? "inbox", draft, assigneeValid) };
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
        if (result.code === "CONFLICT") setConflict(true);
        setMessage(result.message);
        if (["CONFLICT", "FORBIDDEN", "NOT_FOUND"].includes(result.code)) {
          await Promise.all([cache.invalidateQueries({ queryKey: ["issues", workspaceId] }), cache.invalidateQueries({ queryKey: ["membership", workspaceId] }), cache.invalidateQueries({ queryKey: ["members", workspaceId] })]);
        }
        requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(".form-message")?.focus());
        return;
      }
      setDraft(issue ? issueValues(result.data) : issueValues()); setBaseVersion(issue ? result.data.version : undefined);
      setErrors({}); setConflict(false); setMessage(`${result.data.issue_key} 저장했습니다.`);
      // A receipt can describe an older success; fetch the current server row.
      await cache.invalidateQueries({ queryKey: ["issues", workspaceId] });
    } catch (error) {
      if (error instanceof Error && error.message === "OFFLINE") {
        setMessage("오프라인이라 요청을 보내지 않았습니다. 초안을 유지했습니다. 연결 후 직접 저장하세요.");
      } else {
        setUnconfirmed(command);
        setMessage("저장 결과를 확인하지 못했습니다. 입력과 요청을 보존했습니다. 연결 후 같은 요청으로 다시 확인하세요.");
      }
    }
  }
  function textControl(field: (typeof textFields)[number]) {
    const label = field.key === "title" ? issue ? "버그 제목" : "새 버그 제목" : field.label;
    const props = { id: `${id}-${field.key}`, name: field.key, value: draft[field.key], readOnly: !canWrite, "aria-invalid": !!errors[field.key],
      "aria-describedby": `${id}-${field.key}-hint${errors[field.key] ? ` ${id}-${field.key}-error` : ""}`,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(field.key, event.target.value) };
    return <div className="issue-field" key={field.key}>
      <label htmlFor={props.id}>{label}</label>
      {field.key === "title" || field.key === "target_build" ? <input {...props} required={field.key === "title"} /> : <textarea {...props} rows={field.key === "steps" ? 4 : 3} />}
      <p className="form-hint" id={`${id}-${field.key}-hint`}>{field.key === "title" && "필수 · "}{Array.from(draft[field.key].trim()).length.toLocaleString("ko-KR")} / {field.max.toLocaleString("ko-KR")}자{field.key === "reproduction_note" ? " · 간헐적으로 발생할 때 작성" : ""}</p>
      {errors[field.key] && <p className="field-error" id={`${id}-${field.key}-error`}>{errors[field.key]}</p>}
    </div>;
  }
  function selectControl(key: "reproduction" | "severity" | "priority", label: string, options: Record<string, string>, help: string) {
    return <div className="issue-field"><label htmlFor={`${id}-${key}`}>{label}</label>
      <select disabled={!canWrite} id={`${id}-${key}`} name={key} value={draft[key]} onChange={(event) => change(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={`${id}-${key}-hint`}>
        {Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select><p className="form-hint" id={`${id}-${key}-hint`}>{errors[key] || help}</p></div>;
  }
  return <>
    {!canWrite && <p role="alert">쓰기 권한이 없거나 확인되지 않았습니다. 기존 초안은 읽기 전용으로 보존했습니다. 입력을 선택해 복사할 수 있습니다.</p>}
    {issue && <TransitionMenu client={client} issue={issue} blocked={!canWrite || connection?.online === false || locked || (!done && (dirty || stale))} saved={(saved) => {
      if (!dirty) { setDraft(issueValues(saved)); setBaseVersion(saved.version); }
    }} />}
    {done && <p className="read-only-note">완료의 본문은 잠겨 있습니다. 재오픈 후 편집할 수 있습니다.{dirty && " 작성 중이던 초안은 재오픈 전까지 보존합니다."}</p>}
    {issue && (stale || conflict) && <ConflictRecovery issue={issue} draft={draft} members={members.data ?? []} locked={locked} newer={stale} restart={() => {
      setDraft(issueValues(issue)); setBaseVersion(issue.version); setErrors({}); setConflict(false); setMessage(""); focusField("title");
    }} />}
    <form ref={form} hidden={done} className={issue ? "issue-edit-form" : `issue-create-form${expanded ? "" : " compact-create"}`} onSubmit={submit} noValidate
    onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
    onKeyDown={(event) => { if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }}>
    <fieldset disabled={locked || done}>
      <legend className="sr-only">{issue ? "버그 편집" : "버그 등록"}</legend>
      {textControl(textFields[0])}
      {!issue && <button className="disclosure-button" type="button" aria-expanded={expanded} aria-controls={`${id}-fields`} onClick={() => setExpanded(!expanded)}>{expanded ? "재현 정보 접기" : "재현 정보 함께 작성"}</button>}
      <div id={`${id}-fields`} hidden={!expanded}>
        <section className="issue-properties" aria-label="분류와 담당자">
        <div className="field-pair">{selectControl("severity", "심각도", severities, "사용자에게 미치는 영향")}{selectControl("priority", "우선순위", priorities, "팀에서 처리할 순서")}</div>
        <div className="issue-field"><label htmlFor={`${id}-assignee_id`}>담당자</label>
          <select disabled={!canWrite} id={`${id}-assignee_id`} name="assignee_id" value={draft.assignee_id ?? ""} onChange={(event) => change("assignee_id", event.target.value || null)} aria-invalid={!!errors.assignee_id} aria-describedby={`${id}-assignee-hint`}>
            <option value="">미지정</option>
            {draft.assignee_id && !members.data?.some((m) => m.user_id === draft.assignee_id && m.role !== "viewer") && <option value={draft.assignee_id} disabled>기존 담당자 · 권한 확인 또는 재지정 필요</option>}
            {members.data?.filter((m) => m.role === "owner" || m.role === "member").map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name} · {roleLabels[m.role]}</option>)}
          </select><p id={`${id}-assignee-hint`} className={errors.assignee_id ? "field-error" : "form-hint"}>{errors.assignee_id || "같은 팀의 관리자 또는 멤버만 새로 지정할 수 있습니다."}</p>
          {members.isPending && <p role="status">담당자 목록을 불러오는 중…</p>}
          {members.isError && <p role="alert">담당자를 불러오지 못했습니다. <button type="button" onClick={() => members.refetch()}>담당자 다시 조회</button></p>}
        </div>
        <details className="classification-help"><summary>심각도와 우선순위는 어떻게 다른가요?</summary><p>{severityHelp}</p><p>{priorityHelp}</p></details>
        </section>
        <section className="issue-form-section" aria-label="재현 정보 작성">
          <h3>재현 정보</h3>
          <div className="completeness" aria-live="polite"><strong>작성 중인 재현 정보 {fulfilled.count}/4 충족</strong><p>{fulfilled.missing.length ? `누락: ${fulfilled.missing.join(" · ")}` : "재현 단계·기대 결과·실제 결과·환경을 모두 입력했습니다."}</p></div>
          {textControl(textFields[1])}
          <div className="field-pair">{textControl(textFields[2])}{textControl(textFields[3])}</div>
          {textControl(textFields[4])}
          {selectControl("reproduction", "재현 상태", reproductions, "직접 확인한 결과를 선택하세요. 위의 충족 수는 정보 작성 여부입니다.")}
          {textControl(textFields[5])}
        </section>
        <section className="issue-form-section" aria-label="수정 내용 작성"><h3>수정 내용</h3>
          <p className="section-help">재검증으로 옮기기 전에 무엇을 고쳤는지, 어느 버전인지 남겨 주세요.</p>
          {textFields.slice(6).map(textControl)}
        </section>
      </div>
    </fieldset>
    <div className="form-actions"><button className="button button-primary" type="submit" disabled={!canWrite || connection?.online === false || mutation.isPending || (sharedRequest && sharedRequest.command.requestId !== unconfirmed?.requestId) || (stale && !unconfirmed)}>{mutation.isPending ? "저장 중…" : unconfirmed ? "같은 요청으로 다시 확인" : issue ? "변경 저장" : "버그 등록"}</button>
      <span className="form-hint">{issue ? "아직 저장하지 않은 내용은 이 화면에만 남습니다." : "제목만 적어도 등록할 수 있습니다. 재현 정보는 나중에 추가하세요."}</span></div>
    <p className="form-message" role="status" tabIndex={-1}>{message}</p>
  </form></>;
}
