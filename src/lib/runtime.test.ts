import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { isMainModule } from "@/lib/runtime";

describe("isMainModule", () => {
  it("returns true when the module URL matches the entry script", () => {
    const entry = "/repo/src/lib/balldontlie/sync-players.ts";
    expect(isMainModule({ moduleUrl: pathToFileURL(entry).href, argv: ["bun", entry] })).toBe(true);
  });

  it("returns false when another module is the entry script", () => {
    expect(
      isMainModule({
        moduleUrl: pathToFileURL("/repo/src/lib/demo/seed.ts").href,
        argv: ["bun", "/repo/src/lib/balldontlie/sync.ts"],
      }),
    ).toBe(false);
  });

  it("returns false when argv has no entry script", () => {
    expect(isMainModule({ moduleUrl: "file:///repo/x.ts", argv: ["bun"] })).toBe(false);
  });
});
