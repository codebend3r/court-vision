import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safeNextPath";

describe("safeNextPath", () => {
  it("keeps a same-origin absolute path", () => {
    expect(safeNextPath("/players")).toBe("/players");
    expect(safeNextPath("/players?tab=advanced&page=2")).toBe("/players?tab=advanced&page=2");
  });

  it("falls back to / for empty or missing input", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects absolute and scheme-relative URLs (open redirect)", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects a path without a leading slash", () => {
    expect(safeNextPath("players")).toBe("/");
  });
});
