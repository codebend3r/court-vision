import { describe, expect, it } from "bun:test";

import { emailSchema, firstIssue } from "@/lib/auth/formResult";

describe("firstIssue", () => {
  it("answers with the first validation message", () => {
    const parsed = emailSchema.safeParse("not-an-email");
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(firstIssue({ error: parsed.error, fallback: "fallback" })).toEqual({
      ok: false,
      error: "Enter a valid email.",
    });
  });
});
