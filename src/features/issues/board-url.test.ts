import { describe, expect, it } from "vitest";
import { boardHref, normalizeBoardParams, parseBoardParams, serializeBoardParams, visibleIssues } from "./board-url";
import type { Issue } from "./commands";

const id = "a1000000-0000-4000-8000-000000000001";
const normalize = (query: string) => normalizeBoardParams(parseBoardParams(new URLSearchParams(query)));
describe("board URL contract", () => {
  it("parses first values independently of normalization and ignores unrelated keys", () => {
    const raw = parseBoardParams(new URLSearchParams("severity=bad&severity=S2&sort=bad&unused=1"));
    expect(raw.severity).toBe("bad"); expect(raw.sort).toBe("bad");
    expect(boardHref(normalizeBoardParams(raw))).toBe("/board");
  });
  it("omits empty defaults while preserving explicit unset/unassigned filters", () => {
    expect(boardHref(normalize("q=++&sort=updated&severity=&priority=&issue="))).toBe("/board");
    expect(boardHref(normalize("severity=unset&priority=unset&assignee=none"))).toBe("/board?severity=unset&priority=unset&assignee=none");
  });
  it("rejects malformed UUID/enum values and keeps valid unknown ids for permission-aware UI", () => {
    expect(boardHref(normalize("workspace=javascript:alert(1)&issue=not-a-uuid&assignee=none%27&severity=__proto__&priority=P9"))).toBe("/board");
    expect(normalize(`workspace=${id.toUpperCase()}&issue=${id}&assignee=${id}`).workspace).toBe(id);
    expect(normalize(`issue=${id}`).issue).toBe(id);
  });
  it("normalizes Korean NFC and code point limits; escaped text round-trips without query injection", () => {
    const state = normalizeBoardParams({ q: "  \u1100\u1161 &priority=P0 # <script>  ", workspace: id, sort: "priority" });
    expect(state.q).toBe("가 &priority=P0 # <script>");
    expect(normalize(serializeBoardParams(state).toString())).toEqual(state);
    expect(serializeBoardParams(state).get("priority")).toBeNull();
    expect(Array.from(normalizeBoardParams({ q: "😀".repeat(121) }).q)).toHaveLength(120);
    const truncated = normalizeBoardParams({ q: "a".repeat(119) + " b" });
    expect(normalizeBoardParams(truncated)).toEqual(truncated);
  });
  it("canonicalization is idempotent with stable key order", () => {
    const inputs = ["", "sort=updated", "q=한글&issue=bad", `sort=priority&issue=${id}&workspace=${id}&q=login&severity=S2`];
    for (const input of inputs) {
      const once = serializeBoardParams(normalize(input)).toString();
      expect(serializeBoardParams(normalize(once)).toString()).toBe(once);
    }
    expect(boardHref(normalize(inputs[3]))).toBe(`/board?workspace=${id}&q=login&severity=S2&sort=priority&issue=${id}`);
  });
});

const row = (key: string, overrides: Partial<Issue> = {}) => ({ id: key, title: "로그인 Login", issue_key: `RB-${key}`, severity: "S2", priority: "P1", assignee_id: id, updated_at: "2026-09-24T00:00:00Z", ...overrides }) as Issue;
describe("derived board view", () => {
  it("combines case-insensitive title/key search and all filters without mutating the Query array", () => {
    const rows = [row("b"), row("a", { severity: "S1" }), row("c", { title: "다른 제목", assignee_id: null })];
    Object.freeze(rows);
    expect(visibleIssues(rows, normalize(`q=LOGIN&severity=S2&priority=P1&assignee=${id}`)).map((r) => r.id)).toEqual(["b"]);
    expect(visibleIssues(rows, normalize("q=rb-c&assignee=none")).map((r) => r.id)).toEqual(["c"]);
    expect(visibleIssues(rows, normalize("q=존재하지않음"))).toEqual([]);
    expect(rows.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
  it("matches decomposed Korean and treats search punctuation literally", () => {
    expect(visibleIssues([row("a", { title: "\u1100\u1161나다" })], normalize("q=가"))).toHaveLength(1);
    expect(visibleIssues([row("a", { title: "가나다" })], normalize("q=%25"))).toHaveLength(0);
  });
  it("sorts updated descending or priority P0..P3/unset, then updated and stable id", () => {
    const rows = [row("b"), row("a"), row("c", { priority: "P0", updated_at: "2020-01-01T00:00:00Z" }), row("d", { priority: "unset", updated_at: "2026-09-24T01:00:00Z" })];
    expect(visibleIssues(rows, normalize("")).map((r) => r.id)).toEqual(["d", "a", "b", "c"]);
    expect(visibleIssues(rows, normalize("sort=priority")).map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
    expect(visibleIssues([...rows].reverse(), normalize("sort=priority")).map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
  });
});
