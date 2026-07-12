import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

import { GET } from "./route";

const BASE = "http://localhost:46644";

function confirmRequest(query: string): NextRequest {
  return new NextRequest(`${BASE}/auth/confirm${query}`);
}

describe("GET /auth/confirm", () => {
  beforeEach(() => verifyOtp.mockReset());

  it("verifies the OTP and redirects home on success", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(confirmRequest("?token_hash=abc123&type=email"));
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc123" });
    expect(response.headers.get("location")).toBe(`${BASE}/`);
  });

  it("honors the next param on success", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(confirmRequest("?token_hash=abc&type=email&next=/players"));
    expect(response.headers.get("location")).toBe(`${BASE}/players`);
  });

  it("redirects to login when the token is missing", async () => {
    const response = await GET(confirmRequest(""));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${BASE}/login?error=confirm`);
  });

  it("redirects to login when the type is not a valid OTP type", async () => {
    const response = await GET(confirmRequest("?token_hash=abc&type=bogus"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${BASE}/login?error=confirm`);
  });

  it("redirects to login when verifyOtp reports an error", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "token expired" } });
    const response = await GET(confirmRequest("?token_hash=abc&type=email"));
    expect(verifyOtp).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${BASE}/login?error=confirm`);
  });
});
