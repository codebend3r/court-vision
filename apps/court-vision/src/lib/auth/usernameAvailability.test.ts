import { describe, expect, it } from "bun:test";

import { isAvailabilityResponse } from "@/lib/auth/usernameAvailability";

describe("isAvailabilityResponse", () => {
  it("accepts the route's answer either way", () => {
    expect(isAvailabilityResponse({ available: true, valid: true })).toBe(true);
    expect(isAvailabilityResponse({ available: false, valid: false })).toBe(true);
  });

  it("rejects a body without a boolean `available`", () => {
    expect(isAvailabilityResponse({ available: "yes" })).toBe(false);
    expect(isAvailabilityResponse({ valid: true })).toBe(false);
    expect(isAvailabilityResponse(null)).toBe(false);
    expect(isAvailabilityResponse("available")).toBe(false);
  });
});
