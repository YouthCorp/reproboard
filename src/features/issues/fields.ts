import type { Issue } from "./commands";

export const textFields = [
  { key: "title", label: "제목", max: 120 },
  { key: "steps", label: "재현 단계", max: 4000 },
  { key: "expected", label: "기대 결과", max: 4000 },
  { key: "actual", label: "실제 결과", max: 4000 },
  { key: "environment", label: "환경", max: 4000 },
  { key: "reproduction_note", label: "발생 조건 메모", max: 4000 },
  { key: "fix_note", label: "수정 메모", max: 4000 },
  { key: "target_build", label: "대상 빌드", max: 120 },
] as const;
export const reproductions = { unknown: "미확인", reproduced: "재현됨", intermittent: "간헐적 재현", not_reproduced: "재현 안 됨" };
export const severities = { unset: "미설정", S1: "S1 · 핵심 기능 중단·데이터 손실", S2: "S2 · 주요 기능 문제·우회 어려움", S3: "S3 · 부분 문제·우회 가능", S4: "S4 · 표현·경미한 불편" };
export const priorities = { unset: "미설정", P0: "P0 · 긴급", P1: "P1 · 높음", P2: "P2 · 보통", P3: "P3 · 낮음" };
export const severityHelp = "심각도는 버그의 영향입니다. S1 핵심 기능 중단·데이터 손실부터 S4 경미한 불편까지 사람이 판단합니다.";
export const priorityHelp = "우선순위는 팀의 처리 순서입니다. P0 긴급부터 P3 낮음까지 정하며 심각도에서 자동으로 정하지 않습니다.";
export type TextField = (typeof textFields)[number]["key"];
export type IssueValues = Record<TextField, string> & { reproduction: string; severity: string; priority: string; assignee_id: string | null };
export type FieldErrors = Partial<Record<keyof IssueValues, string>>;
export type Member = { user_id: string; role: string; display_name: string };
export const emptyValues: IssueValues = { title: "", steps: "", expected: "", actual: "", environment: "", reproduction: "unknown", reproduction_note: "", severity: "unset", priority: "unset", assignee_id: null, fix_note: "", target_build: "" };
export function issueValues(issue?: Issue): IssueValues {
  if (!issue) return { ...emptyValues };
  return Object.fromEntries(Object.keys(emptyValues).map((key) => [key, issue[key as keyof IssueValues] ?? emptyValues[key as keyof IssueValues]])) as IssueValues;
}
export function normalized(values: IssueValues): IssueValues {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as IssueValues;
}
export function validateFields(values: IssueValues, members: Member[], existingAssignee?: string | null): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of textFields) {
    const count = Array.from(values[field.key].trim()).length;
    if ((field.key === "title" && count === 0) || count > field.max) errors[field.key] = `${field.label}: 공백 제거 후 ${field.key === "title" ? "1~120" : `최대 ${field.max.toLocaleString("ko-KR")}`}자까지 입력하세요.`;
  }
  if (!Object.hasOwn(reproductions, values.reproduction)) errors.reproduction = "재현 상태를 선택하세요.";
  if (!Object.hasOwn(severities, values.severity)) errors.severity = "심각도를 선택하세요.";
  if (!Object.hasOwn(priorities, values.priority)) errors.priority = "우선순위를 선택하세요.";
  if (values.reproduction === "intermittent" && !values.reproduction_note.trim()) errors.reproduction_note = "간헐적 재현에는 발생 조건 메모가 필요합니다.";
  if (values.assignee_id && values.assignee_id !== existingAssignee && !members.some((m) => m.user_id === values.assignee_id && (m.role === "owner" || m.role === "member"))) errors.assignee_id = "담당자는 같은 팀의 Owner 또는 Member여야 합니다.";
  return errors;
}
export function completeness(values: Pick<IssueValues, "steps" | "expected" | "actual" | "environment">) {
  const missing = textFields.filter((field) => ["steps", "expected", "actual", "environment"].includes(field.key))
    .filter((field) => !values[field.key as keyof typeof values].trim()).map((field) => field.label);
  return { count: 4 - missing.length, missing };
}
export const boardColumns = [
  { id: "inbox", name: "Inbox", description: "새로 접수된 버그", tone: "neutral" },
  { id: "ready", name: "Ready", description: "착수할 준비가 된 버그", tone: "blue" },
  { id: "in_progress", name: "In Progress", description: "수정 중인 버그", tone: "amber" },
  { id: "verify", name: "Verify", description: "재검증을 기다리는 버그", tone: "violet" },
  { id: "done", name: "Done", description: "재검증을 마친 버그", tone: "green" },
] as const;
