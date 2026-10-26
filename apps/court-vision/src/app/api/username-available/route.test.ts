import { beforeEach, describe, expect, it, vi } from "bun:test";
import { NextRequest } from "next/server";

const allowUsernameAttempt = vi.fn();
const isUsernameTaken = vi.fn();
vi.mock("@/lib/auth/usernameRateLimit", () => ({
  allowUsernameAttempt,
  USERNAME_RETRY_SECONDS: 60,
  USERNAME_RATE_LIMIT_MESSAGE: "Try later",
}));
vi.mock("@/lib/auth/usernameTaken", () => ({ isUsernameTaken }));

import { GET } from "@/app/api/username-available/route";

beforeEach(() => {
  allowUsernameAttempt.mockReset();
  isUsernameTaken.mockReset();
  allowUsernameAttempt.mockResolvedValue(true);
  isUsernameTaken.mockResolvedValue(false);
});

describe("username availability rate limit", () => {
  it("returns 429 without querying usernames when the shared budget is exhausted", async () => {
    allowUsernameAttempt.mockResolvedValue(false);
    const response = await GET(new NextRequest("http://localhost/api/username-available?u=steve"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(isUsernameTaken).not.toHaveBeenCalled();
  });
  it("validates before spending the budget and serves valid allowed checks", async () => {
    const invalid = await GET(new NextRequest("http://localhost/api/username-available?u=a"));
    expect(await invalid.json()).toEqual({ available: false, valid: false });
    expect(allowUsernameAttempt).not.toHaveBeenCalled();
    const valid = await GET(new NextRequest("http://localhost/api/username-available?u=steve"));
    expect(await valid.json()).toEqual({ available: true, valid: true });
    expect(isUsernameTaken).toHaveBeenCalledWith({ username: "steve" });
  });
});
