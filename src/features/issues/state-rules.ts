import type { FieldErrors, IssueValues } from "./fields";

export const transitions = {
  inbox: ["ready"], ready: ["inbox", "in_progress"], in_progress: ["ready", "verify"],
  verify: ["in_progress", "done"], done: ["inbox"],
} as const;
export type IssueStatus = keyof typeof transitions;
export function isStatus(value: string): value is IssueStatus { return Object.hasOwn(transitions, value); }
export function canTransition(from: string, to: string): boolean {
  return isStatus(from) && (transitions[from] as readonly string[]).includes(to);
}
export function needsReason(from: string, to: string) {
  return (from === "ready" && to === "inbox") || (from === "in_progress" && to === "ready") || (from === "done" && to === "inbox");
}
export function needsVerification(from: string, to: string) { return from === "verify" && (to === "done" || to === "in_progress"); }

// Pure counterpart of private.issue_state_errors. Call with the *proposed* fields.
export function stateFieldErrors(status: string, fields: IssueValues, assigneeValid: boolean): FieldErrors {
  if (status === "inbox") return {};
  const errors: FieldErrors = {};
  for (const [key, label] of [["steps", "재현 단계"], ["expected", "기대 결과"], ["actual", "실제 결과"], ["environment", "환경"]] as const) {
    if (!fields[key].trim()) errors[key] = `${label}${key === "environment" ? "을" : "를"} 입력하세요.`;
  }
  if (!["reproduced", "intermittent"].includes(fields.reproduction)) errors.reproduction = "진행 대기로 이동하려면 ‘재현됨’ 또는 ‘간헐적 재현’을 확인하세요.";
  if (fields.reproduction === "intermittent" && !fields.reproduction_note.trim()) errors.reproduction_note = "간헐적 재현의 발생 조건을 입력하세요.";
  if (!["S1", "S2", "S3", "S4"].includes(fields.severity)) errors.severity = "심각도를 설정하세요.";
  if (!["P0", "P1", "P2", "P3"].includes(fields.priority)) errors.priority = "우선순위를 설정하세요.";
  if (["in_progress", "verify", "done"].includes(status) && !assigneeValid) errors.assignee_id = "같은 팀의 관리자 또는 멤버를 담당자로 지정하세요.";
  if (["verify", "done"].includes(status)) {
    if (!fields.fix_note.trim()) errors.fix_note = "수정 메모를 입력하세요.";
    if (!fields.target_build.trim()) errors.target_build = "수정한 앱 버전을 입력하세요.";
  }
  return errors;
}

export type TransitionInputs = { reason: string; tested_build: string; tested_environment: string; note: string };
export function transitionInputErrors(from: string, to: string, input: TransitionInputs) {
  const errors: Partial<Record<keyof TransitionInputs, string>> = {};
  if (needsReason(from, to) && !input.reason.trim()) errors.reason = "이동 사유를 입력하세요.";
  if (needsVerification(from, to)) {
    if (!input.tested_build.trim()) errors.tested_build = "실제로 검증한 앱 버전을 입력하세요.";
    if (!input.tested_environment.trim()) errors.tested_environment = "실제로 검증한 환경을 입력하세요.";
    if (to === "in_progress" && !input.note.trim()) errors.note = "검증 실패 이유를 입력하세요.";
  }
  for (const key of Object.keys(input) as (keyof TransitionInputs)[]) {
    if (Array.from(input[key].trim()).length > (key === "tested_build" ? 120 : 4000)) errors[key] = key === "tested_build" ? "앱 버전은 최대 120자입니다." : "최대 4,000자까지 입력하세요.";
  }
  return errors;
}
