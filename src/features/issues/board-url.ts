import type { Issue } from "./commands";

export const boardParamKeys = ["workspace", "q", "severity", "priority", "assignee", "sort", "issue"] as const;
export type RawBoardParams = Record<(typeof boardParamKeys)[number], string>;
export type BoardParams = RawBoardParams & { sort: "updated" | "priority" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (value: string) => uuidPattern.test(value) ? value.toLowerCase() : "";
const choice = (value: string, allowed: string[]) => allowed.includes(value) ? value : "";

// Parsing deliberately does not validate. Duplicate keys use the first value.
export function parseBoardParams(params: Pick<URLSearchParams, "get">): RawBoardParams {
  return Object.fromEntries(boardParamKeys.map((key) => [key, params.get(key) ?? ""])) as RawBoardParams;
}
export function normalizeBoardParams(raw: Partial<RawBoardParams>): BoardParams {
  return {
    workspace: uuid(raw.workspace ?? ""),
    q: Array.from((raw.q ?? "").trim().normalize("NFC")).slice(0, 120).join("").trimEnd(),
    severity: choice(raw.severity ?? "", ["unset", "S1", "S2", "S3", "S4"]),
    priority: choice(raw.priority ?? "", ["unset", "P0", "P1", "P2", "P3"]),
    assignee: raw.assignee === "none" ? "none" : uuid(raw.assignee ?? ""),
    sort: raw.sort === "priority" ? "priority" : "updated",
    issue: uuid(raw.issue ?? ""),
  };
}
export function serializeBoardParams(state: BoardParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of boardParamKeys) if (state[key] && !(key === "sort" && state.sort === "updated")) params.set(key, state[key]);
  return params;
}
export function boardHref(state: BoardParams) {
  const query = serializeBoardParams(state).toString();
  return `/board${query ? `?${query}` : ""}`;
}

const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, unset: 4 };
export function visibleIssues(issues: readonly Issue[], state: BoardParams): Issue[] {
  const query = state.q.toLowerCase();
  return issues.filter((issue) => (!query || issue.title.normalize("NFC").toLowerCase().includes(query) || issue.issue_key.toLowerCase().includes(query))
    && (!state.severity || issue.severity === state.severity)
    && (!state.priority || issue.priority === state.priority)
    && (!state.assignee || (state.assignee === "none" ? !issue.assignee_id : issue.assignee_id === state.assignee)))
    .sort((a, b) => (state.sort === "priority" ? (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4) : 0)
      || Date.parse(b.updated_at) - Date.parse(a.updated_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
