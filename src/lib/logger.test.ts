import { afterEach, describe, expect, it, vi } from "vitest";

import { consoleLogger, silentLogger } from "@/lib/logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("consoleLogger", () => {
  it("writes the message to stdout", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    consoleLogger("syncing");

    expect(log).toHaveBeenCalledWith("syncing");
  });
});

describe("silentLogger", () => {
  it("swallows the message", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    silentLogger("syncing");

    expect(log).not.toHaveBeenCalled();
  });
});
