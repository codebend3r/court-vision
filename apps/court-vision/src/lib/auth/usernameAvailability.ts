// What GET /api/username-available answers: whether the name is free, and
// whether it was a valid username at all (an invalid one is never available).
export type UsernameAvailability = { available: boolean; valid: boolean };

// The response body arrives as `unknown`; the sign-up form only trusts it
// once it carries a boolean `available`.
export const isAvailabilityResponse = (
  value: unknown,
): value is Pick<UsernameAvailability, "available"> =>
  typeof value === "object" &&
  value !== null &&
  "available" in value &&
  typeof value.available === "boolean";
