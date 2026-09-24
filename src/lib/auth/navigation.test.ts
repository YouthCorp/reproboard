import { describe, expect, it } from "vitest";
import { safeNext } from "./navigation";

describe("authentication return paths", () => {
  it("rejects external, encoded, backslash and arbitrary paths", () => {
    for (const value of ["https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/%2f%2fevil.invalid", "/auth/callback", "/board/../auth", null, ["/invite"]]) {
      expect(safeNext(value)).toBe("/board");
    }
  });
  it("preserves only supported navigation state and never invite tokens in a query", () => {
    const id = "a1000000-0000-4000-8000-000000000001";
    expect(safeNext(`/board?workspace=${id}&next=https://evil.invalid#secret`)).toBe(`/board?workspace=${id}`);
    expect(safeNext("/invite?token=secret#secret")).toBe("/invite");
    expect(safeNext("/board?workspace=bad")).toBe("/board");
    expect(safeNext(`/board?workspace=${id}&issue=${id}&token=secret`)).toBe(`/board?workspace=${id}&issue=${id}`);
    expect(safeNext("/board?issue=bad")).toBe("/board");
  });
  it("preserves canonical board filters across login while stripping redirects and tokens", () => {
    const id = "a1000000-0000-4000-8000-000000000001";
    expect(safeNext(`/board?sort=priority&workspace=${id}&q=login&severity=S2&priority=P1&assignee=${id}&issue=${id}&token=secret&next=https://evil.invalid`))
      .toBe(`/board?workspace=${id}&q=login&severity=S2&priority=P1&assignee=${id}&sort=priority&issue=${id}`);
    expect(safeNext("/board?q=%26next%3Dhttps%3A%2F%2Fevil.invalid&severity=bad&sort=bad"))
      .toBe("/board?q=%26next%3Dhttps%3A%2F%2Fevil.invalid");
  });
});
