"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppSupabase } from "@/lib/supabase/browser";
import { useMembers } from "@/features/workspaces/use-members";
import type { Issue, TransitionCommand } from "./commands";
import { useIssueCommands } from "./issue-commands";
import { ConnectionHint, useConnection } from "./issue-realtime";
import { boardColumns, issueValues, textFields } from "./fields";
import { canTransition, isStatus, needsReason, needsVerification, stateFieldErrors, transitionInputErrors, transitions, type TransitionInputs } from "./state-rules";

const nameOf = (status: string) => boardColumns.find((column) => column.id === status)?.name ?? status;

export function TransitionDialog({ client, issue, target, close, saved }: { client: AppSupabase; issue: Issue; target: string; close: () => void; saved?: (issue: Issue) => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const composing = useRef(false);
  const cache = useQueryClient();
  const commands = useIssueCommands();
  const connection = useConnection();
  const members = useMembers(client, issue.workspace_id);
  const [base, setBase] = useState({ version: issue.version, status: issue.status });
  const [input, setInput] = useState<TransitionInputs>({ reason: "", tested_build: issue.target_build, tested_environment: "", note: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof TransitionInputs, string>>>({});
  const [message, setMessage] = useState("");
  const [unconfirmed, setUnconfirmed] = useState<TransitionCommand | null>(null);
  const mutation = useMutation({ retry: false, networkMode: "always", mutationFn: (command: TransitionCommand) => commands.run(command) });
  useEffect(() => {
    const element = dialog.current!; const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const assigneeValid = !!issue.assignee_id && !!members.data?.some((m) => m.user_id === issue.assignee_id && (m.role === "owner" || m.role === "member"));
  const missing = Object.values(stateFieldErrors(target, issueValues(issue), assigneeValid));
  const stale = base.version !== issue.version;
  const allowed = canTransition(issue.status, target);
  const busy = mutation.isPending || !!unconfirmed;
  const verification = needsVerification(base.status, target);
  const reason = needsReason(base.status, target);
  async function refresh() {
    await Promise.all([cache.invalidateQueries({ queryKey: ["issues", issue.workspace_id] }), cache.invalidateQueries({ queryKey: ["verification-runs", issue.workspace_id, issue.id] }), cache.invalidateQueries({ queryKey: ["transitions", issue.workspace_id, issue.id] }), cache.invalidateQueries({ queryKey: ["members", issue.workspace_id] }), cache.invalidateQueries({ queryKey: ["membership", issue.workspace_id] })]);
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (!commands.canWrite || mutation.isPending || composing.current) return;
    if (!unconfirmed) {
      const validation = transitionInputErrors(base.status, target, input);
      setErrors(validation);
      if (Object.keys(validation).length) {
        requestAnimationFrame(() => (form.current?.elements.namedItem(Object.keys(validation)[0]) as HTMLElement | null)?.focus()); return;
      }
      if (stale || !allowed || missing.length) return;
    }
    const command: TransitionCommand = unconfirmed ?? { operation: "transition", workspaceId: issue.workspace_id, issueId: issue.id, expectedVersion: base.version, requestId: crypto.randomUUID(), payload: {
      target_status: target, ...(reason ? { reason: input.reason.trim() } : {}),
      ...(verification ? { verification: { tested_build: input.tested_build.trim(), tested_environment: input.tested_environment.trim(), note: input.note.trim() } } : {}),
    } };
    setMessage("");
    try {
      const result = await mutation.mutateAsync(command); setUnconfirmed(null);
      if (!result.ok) { setMessage(result.message); await refresh(); requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(".transition-message")?.focus()); return; }
      saved?.(result.data);
      await refresh(); close();
    } catch (error) {
      if (error instanceof Error && error.message === "OFFLINE") setMessage("오프라인이라 이동 요청을 보내지 않았습니다. 입력을 유지했습니다.");
      else { setUnconfirmed(command); setMessage("이동 결과를 확인하지 못했습니다. 결과 확인 중입니다. 같은 요청으로 다시 확인하세요. 보드에서 계속 작업해도 이 요청은 유지됩니다."); }
    }
  }
  function field(key: keyof TransitionInputs, label: string, hint: string) {
    const props = { id: `${id}-${key}`, name: key, value: input[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setInput((old) => ({ ...old, [key]: event.target.value })); setErrors((old) => ({ ...old, [key]: undefined })); }, "aria-invalid": !!errors[key], "aria-describedby": `${id}-${key}-hint` };
    return <div className="issue-field"><label htmlFor={props.id}>{label}</label>
      {key === "tested_build" ? <input {...props} /> : <textarea {...props} rows={3} />}
      <p id={`${id}-${key}-hint`} className={errors[key] ? "field-error" : "form-hint"}>{errors[key] || hint}</p></div>;
  }
  return <dialog ref={dialog} className="transition-dialog" aria-labelledby={`${id}-heading`} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!busy) close(); }}>
    <h2 id={`${id}-heading`}>{nameOf(base.status)} → {nameOf(target)}</h2>
    <ConnectionHint />
    <p className="form-hint">{issue.issue_key} · 저장된 내용으로 이동합니다. 취소하면 이동하지 않습니다.</p>
    {!commands.canWrite && <p role="alert">쓰기 권한을 확인할 수 없습니다. 이동 입력을 유지했습니다.</p>}
    <form ref={form} onSubmit={submit} noValidate onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={(event) => { if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }}>
      {missing.length > 0 && <div className="transition-requirements" role="alert"><strong>먼저 필수 정보를 저장하세요.</strong><ul>{missing.map((message) => <li key={message}>{message}</li>)}</ul></div>}
      {!allowed && <p role="alert">현재 상태에서는 이 이동을 할 수 없습니다. 취소 후 이동 대상을 다시 선택하세요.</p>}
      {stale && <div className="stale-draft" role="alert"><p>이 창을 연 뒤 이슈가 변경됐습니다. 입력을 유지했습니다. 최신 내용을 확인하고 다시 검증하세요.</p>
        <details><summary>최신 저장 내용 확인</summary><dl className="issue-read-view">{textFields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{issue[field.key] || "미입력"}</dd></div>)}</dl></details>
        <button className="button button-secondary" type="button" disabled={busy || !allowed} onClick={() => { setBase({ version: issue.version, status: issue.status }); setMessage(""); }}>최신 이슈를 확인하고 다시 시도</button></div>}
      <fieldset disabled={busy}>
        <legend className="sr-only">상태 이동 입력</legend>
        {reason && field("reason", base.status === "done" ? "재오픈 사유" : "이동 사유", "필수 · 공백 제거 후 1~4,000자")}
        {verification && <><p className="verification-intent">{target === "done" ? "재검증 통과를 기록하고 Done으로 이동합니다." : "재검증 실패를 기록하고 In Progress로 되돌립니다."}</p>
          {field("tested_build", "검증한 앱 버전", "필수 · 실제로 검증한 버전 · 최대 120자")}
          {field("tested_environment", "검증 환경", "필수 · OS/브라우저 등 실제 검증 환경 · 최대 4,000자")}
          {field("note", target === "done" ? "검증 메모" : "검증 실패 이유", `${target === "done" ? "선택" : "필수"} · 최대 4,000자`)}
        </>}
      </fieldset>
      <p className="transition-message" role="status" tabIndex={-1}>{message}</p>
      <div className="form-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={close} autoFocus>이동 취소</button>
        {busy && <button type="button" className="button button-secondary" onClick={close}>보드에서 계속 작업</button>}
        <button className="button button-primary" type="submit" disabled={!commands.canWrite || connection?.online === false || mutation.isPending || (!unconfirmed && (stale || !allowed || missing.length > 0))}>{mutation.isPending ? "이동 중…" : unconfirmed ? "같은 이동 요청으로 다시 확인" : verification ? target === "done" ? "통과 기록 후 Done" : "실패 기록 후 In Progress" : "이동 확인"}</button></div>
    </form>
  </dialog>;
}

export function TransitionMenu({ client, issue, blocked = false, saved }: { client: AppSupabase; issue: Issue; blocked?: boolean; saved?: (issue: Issue) => void }) {
  const [target, setTarget] = useState<string | null>(null);
  const options = isStatus(issue.status) ? transitions[issue.status] : [];
  return <section className="transition-menu" aria-label="상태 이동">
    <strong>상태 이동</strong><p className="form-hint">{blocked ? "작성 중인 변경을 먼저 저장하거나 최신 값으로 다시 편집하세요." : "저장된 정보를 확인한 뒤 이동을 확정합니다."}</p>
    <div className="transition-options">{options.map((status) => <button type="button" className="button button-secondary" key={status} disabled={blocked} onClick={() => setTarget(status)}>{status === "done" ? "검증 통과 → Done" : issue.status === "verify" ? "검증 실패 → In Progress" : issue.status === "done" ? "재오픈 → Inbox" : `${nameOf(status)}로 이동`}</button>)}</div>
    {target && <TransitionDialog client={client} issue={issue} target={target} close={() => setTarget(null)} saved={saved} />}
  </section>;
}
