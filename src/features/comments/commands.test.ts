import { describe, expect, it } from "vitest";
import { validateComment } from "./commands";
describe("comment input contract", () => {
  it("uses trimmed Unicode code points and deduplicated mention limit", () => {
    expect(validateComment(" \uFEFF\u3000", [])).toContain("1~4,000");
    expect(validateComment(" 😀".trim().repeat(4000), [])).toBe("");
    expect(validateComment("😀".repeat(4001), [])).toContain("1~4,000");
    expect(validateComment("본문", Array(9).fill("one"))).toBe("");
    expect(validateComment("본문", Array.from({ length: 9 }, (_, i) => String(i)))).toContain("8명");
  });
});
