import { describe, expect, it } from "bun:test";

import { safeNextPath } from "@/lib/auth/safeNextPath";

describe("safeNextPath", () => {
  it("keeps a same-origin absolute path", () => {
    expect(safeNextPath({ next: "/players" })).toBe("/players");
    expect(safeNextPath({ next: "/players?tab=advanced&page=2" })).toBe(
      "/players?tab=advanced&page=2",
    );
  });

  it("falls back to / for empty or missing input", () => {
    expect(safeNextPath({ next: null })).toBe("/");
    expect(safeNextPath({ next: undefined })).toBe("/");
    expect(safeNextPath({ next: "" })).toBe("/");
  });

  it("rejects absolute and scheme-relative URLs (open redirect)", () => {
    expect(safeNextPath({ next: "https://evil.com" })).toBe("/");
    expect(safeNextPath({ next: "//evil.com" })).toBe("/");
    expect(safeNextPath({ next: "/\\evil.com" })).toBe("/");
    expect(safeNextPath({ next: "javascript:alert(1)" })).toBe("/");
  });

  it("rejects a path without a leading slash", () => {
    expect(safeNextPath({ next: "players" })).toBe("/");
  });

  // The URL parser strips these before parsing, so "/\t/evil.com" clears a
  // naive prefix check and then resolves to https://evil.com/.
  it("rejects a protocol-relative target smuggled past the prefix check with a tab or newline", () => {
    expect(safeNextPath({ next: "/\t/evil.com" })).toBe("/");
    expect(safeNextPath({ next: "/\n/evil.com" })).toBe("/");
    expect(safeNextPath({ next: "/\r/evil.com" })).toBe("/");
    expect(safeNextPath({ next: "/\r\n/evil.com" })).toBe("/");
  });

  it("rejects a backslash smuggled past the prefix check", () => {
    expect(safeNextPath({ next: "/\t\\evil.com" })).toBe("/");
  });

  it("strips control characters from an otherwise same-origin path", () => {
    expect(safeNextPath({ next: "/play\ters" })).toBe("/players");
  });
});
