import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { Issue, TransitionCommand } from "./commands";
import { emptyValues } from "./fields";
import { acceptIssue, mergeIssueSnapshot } from "./issue-cache";
import { commandKey, createCommandStore, displayedStatus } from "./command-store";

const row = (id: string, version = 1): Issue => ({ ...emptyValues, id, issue_key: id, workspace_id: "team", status: "inbox", version, created_by: "owner", updated_by: "owner", created_at: "2026-09-21T00:00:00Z", updated_at: "2026-09-21T00:00:00Z" });
const move = (issueId: string, requestId = issueId): TransitionCommand => ({ operation: "transition", workspaceId: "team", issueId, expectedVersion: 1, requestId, payload: { target_status: "ready" } });

describe("request overlays and monotonic server cache", () => {
  it("reserves one command per issue synchronously while another issue remains available", () => {
    const store = createCommandStore().getState();
    expect(store.begin(move("A"))).toBe(true);
    expect(store.begin(move("A", "second"))).toBe(false);
    expect(store.begin(move("B"))).toBe(true);
    expect(store.begin({ operation: "update", workspaceId: "team", issueId: "A", requestId: "edit", expectedVersion: 1, payload: emptyValues })).toBe(false);
  });
  it("unknown results retain the exact request, reject changed payload and permit only explicit same-request retry", () => {
    const store = createCommandStore(); const command = move("A");
    store.getState().begin(command); store.getState().uncertain(command);
    expect(store.getState().begin({ ...command, payload: { target_status: "in_progress" } })).toBe(false);
    expect(store.getState().requests[commandKey(command)].phase).toBe("uncertain");
    expect(store.getState().begin(command)).toBe(true);
    expect(store.getState().begin(command)).toBe(false);
  });
  it("rejecting A removes only A's overlay and does not change B or the server data", () => {
    const store = createCommandStore(); const rows = [row("A"), row("B")];
    store.getState().begin(move("A")); store.getState().begin(move("B"));
    expect(displayedStatus(rows[0], store.getState().requests["team/A"])).toBe("ready");
    store.getState().finish(move("A"), "거부");
    expect(displayedStatus(rows[0], store.getState().requests["team/A"])).toBe("inbox");
    expect(displayedStatus(rows[1], store.getState().requests["team/B"])).toBe("ready");
    expect(rows.map((r) => r.status)).toEqual(["inbox", "inbox"]);
  });
  it("a newer server value supersedes presentation while its receipt remains uncertain", () => {
    const pending = { command: move("A"), phase: "uncertain" as const };
    expect(displayedStatus({ ...row("A", 3), status: "in_progress" }, pending)).toBe("in_progress");
    expect(pending.phase).toBe("uncertain");
  });
  it("late snapshots and old receipt responses never lower versions in the actual Query cache", () => {
    const cache = new QueryClient(); const key = ["issues", "team"];
    cache.setQueryDefaults(key, { structuralSharing: (old, next) => mergeIssueSnapshot(old as Issue[] | undefined, next as Issue[]) });
    cache.setQueryData(key, [row("A"), row("B")]);
    cache.setQueryData<Issue[]>(key, (old) => acceptIssue(old, { ...row("A", 3), status: "in_progress" }));
    cache.setQueryData(key, [row("A", 1), row("B", 2)]);
    cache.setQueryData<Issue[]>(key, (old) => acceptIssue(old, { ...row("A", 2), status: "ready" }));
    expect(cache.getQueryData<Issue[]>(key)?.map((r) => [r.id, r.version, r.status])).toEqual([["A", 3, "in_progress"], ["B", 2, "inbox"]]);
    cache.clear();
  });
  it("sorts by server updated_at/id and follows an empty authorized snapshot", () => {
    const rows = [row("B"), row("A")];
    expect(mergeIssueSnapshot(undefined, rows).map((r) => r.id)).toEqual(["A", "B"]);
    expect(mergeIssueSnapshot(rows, [])).toEqual([]);
    expect(acceptIssue(rows, { ...row("B", 2), updated_at: "2026-09-22T00:00:00Z" })[0].id).toBe("B");
  });
  it("stale completion cannot remove a subsequent command and a new owner starts empty", () => {
    const store = createCommandStore(); const first = move("A"), second = move("A", "next");
    store.getState().begin(first); store.getState().finish(first, "saved"); store.getState().begin(second);
    store.getState().finish(first, "late");
    expect(store.getState().requests["team/A"].command.requestId).toBe("next");
    expect(createCommandStore().getState().requests).toEqual({});
  });
});
