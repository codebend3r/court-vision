import { describe, expect, it } from "bun:test";

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

  // The URL parser strips these before parsing, so "/\t/evil.com" clears a
  // naive prefix check and then resolves to https://evil.com/.
  it("rejects a protocol-relative target smuggled past the prefix check with a tab or newline", () => {
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("/\n/evil.com")).toBe("/");
    expect(safeNextPath("/\r/evil.com")).toBe("/");
    expect(safeNextPath("/\r\n/evil.com")).toBe("/");
  });

  it("rejects a backslash smuggled past the prefix check", () => {
    expect(safeNextPath("/\t\\evil.com")).toBe("/");
  });

  it("strips control characters from an otherwise same-origin path", () => {
    expect(safeNextPath("/play\ters")).toBe("/players");
  });
});
