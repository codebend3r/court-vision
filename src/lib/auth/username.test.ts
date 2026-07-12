import { describe, expect, it } from "vitest";

import { isValidUsername, normalizeUsername, usernameSchema } from "./username";

describe("username", () => {
  it("normalizes case and trims", () => {
    expect(normalizeUsername("  SteveN_1 ")).toBe("steven_1");
  });

  it("accepts a valid username", () => {
    expect(usernameSchema.safeParse("court_vision7").success).toBe(true);
  });

  it("rejects too short, bad chars, and reserved names", () => {
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("has space")).toBe(false);
    expect(isValidUsername("Has-Dash")).toBe(false);
    expect(isValidUsername("admin")).toBe(false);
  });
});
