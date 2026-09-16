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
  });
});
