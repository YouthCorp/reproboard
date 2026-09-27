import { describe, expect, it } from "vitest";
import { emptyValues } from "./fields";
import { canTransition, needsReason, needsVerification, stateFieldErrors, transitionInputErrors } from "./state-rules";

const ready = { ...emptyValues, title: "합성 버그", steps: "1. 열기", expected: "표시", actual: "빈 화면", environment: "로컬", reproduction: "reproduced", severity: "S2", priority: "P1" };
const verified = { ...ready, assignee_id: "member", fix_note: "렌더링 수정", target_build: "local-1" };
const states = ["inbox", "ready", "in_progress", "verify", "done"];
const edges = new Set(["inbox/ready", "ready/inbox", "ready/in_progress", "in_progress/ready", "in_progress/verify", "verify/in_progress", "verify/done", "done/inbox"]);
describe("PRD transition contract", () => {
  it.each(states.flatMap((from) => states.map((to) => [from, to])))("%s → %s matches the fixed transition table", (from, to) => {
    expect(canTransition(from, to)).toBe(edges.has(`${from}/${to}`));
  });
  it("rejects unknown states and separates reasons from verification outcomes", () => {
    expect(canTransition("unknown", "ready")).toBe(false); expect(canTransition("verify", "unknown")).toBe(false);
    expect(needsReason("done", "inbox")).toBe(true); expect(needsReason("ready", "inbox")).toBe(true);
    expect(needsReason("in_progress", "ready")).toBe(true); expect(needsReason("verify", "in_progress")).toBe(false);
    expect(needsVerification("verify", "done")).toBe(true); expect(needsVerification("verify", "in_progress")).toBe(true);
  });
  it("allows title-only 접수 and requires all reproduction/classification fields before 진행 대기", () => {
    expect(stateFieldErrors("inbox", emptyValues, false)).toEqual({});
    expect(Object.keys(stateFieldErrors("ready", emptyValues, false))).toEqual(["steps", "expected", "actual", "environment", "reproduction", "severity", "priority"]);
    expect(stateFieldErrors("ready", ready, false)).toEqual({});
    for (const key of ["steps", "expected", "actual", "environment"] as const) expect(stateFieldErrors("ready", { ...ready, [key]: "\u3000\uFEFF" }, false)[key]).toBeTruthy();
    expect(stateFieldErrors("ready", { ...ready, reproduction: "intermittent", reproduction_note: " " }, false).reproduction_note).toBeTruthy();
  });
  it("requires a current writer assignee and fix/build fields while allowing a retreat to 진행 대기", () => {
    expect(stateFieldErrors("in_progress", ready, false).assignee_id).toBeTruthy();
    expect(stateFieldErrors("in_progress", ready, true)).toEqual({});
    expect(Object.keys(stateFieldErrors("verify", ready, true))).toEqual(["fix_note", "target_build"]);
    expect(stateFieldErrors("done", verified, true)).toEqual({});
    expect(stateFieldErrors("verify", verified, false).assignee_id).toBeTruthy();
    expect(stateFieldErrors("ready", verified, false)).toEqual({});
  });
  it("requires actual tested build/environment, fail note and bounded reopen reasons", () => {
    const empty = { reason: "", tested_build: "", tested_environment: "", note: "" };
    expect(Object.keys(transitionInputErrors("verify", "done", empty))).toEqual(["tested_build", "tested_environment"]);
    expect(transitionInputErrors("verify", "in_progress", { ...empty, tested_build: "build", tested_environment: "dev" }).note).toBeTruthy();
    expect(transitionInputErrors("done", "inbox", { ...empty, reason: "\u3000" }).reason).toBeTruthy();
    expect(transitionInputErrors("done", "inbox", { ...empty, reason: "😀".repeat(4000) })).toEqual({});
    expect(transitionInputErrors("done", "inbox", { ...empty, reason: "😀".repeat(4001) }).reason).toBeTruthy();
  });
});
