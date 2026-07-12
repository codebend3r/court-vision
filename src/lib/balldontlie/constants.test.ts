import { afterEach, describe, expect, it } from "vitest";

import { getApiKey } from "@/lib/balldontlie/constants";

const original = process.env.BALLDONTLIE_API_KEY;

afterEach(() => {
  if (original === undefined) {
    delete process.env.BALLDONTLIE_API_KEY;
  } else {
    process.env.BALLDONTLIE_API_KEY = original;
  }
});

describe("getApiKey", () => {
  it("returns the key when set", () => {
    process.env.BALLDONTLIE_API_KEY = "abc-123";
    expect(getApiKey()).toBe("abc-123");
  });

  it("throws a clear error when unset", () => {
    delete process.env.BALLDONTLIE_API_KEY;
    expect(() => getApiKey()).toThrow(/BALLDONTLIE_API_KEY/);
  });
});
