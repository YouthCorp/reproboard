import type { Issue } from "./commands";

export function sortIssues(rows: Issue[]) {
  return [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
}

// Compare at cache commit, not query start: a mutation may finish during a GET.
// Missing rows follow the authorized snapshot; this is not a second server cache.
export function mergeIssueSnapshot(current: Issue[] | undefined, incoming: Issue[]) {
  const byId = new Map(current?.map((row) => [row.id, row]));
  return sortIssues(incoming.map((row) => {
    const previous = byId.get(row.id);
    return previous && previous.version > row.version ? previous : row;
  }));
}

export function acceptIssue(current: Issue[] | undefined, incoming: Issue) {
  const rows = current ?? [];
  const previous = rows.find((row) => row.id === incoming.id);
  if (previous && previous.version >= incoming.version) return rows;
  return sortIssues([...rows.filter((row) => row.id !== incoming.id), incoming]);
}
