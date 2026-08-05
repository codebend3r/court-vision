import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "bun:test";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}));

import { GET } from "./route";

const BASE = "http://localhost:46644";

function confirmRequest(query: string): NextRequest {
  return new NextRequest(`${BASE}/auth/confirm${query}`);
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    exchangeCodeForSession.mockReset();
  });

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

  // @supabase/ssr pins flowType: "pkce", so the stock confirmation email — which
  // routes through Supabase's /auth/v1/verify — lands here with a `code`, never
  // a token_hash. Handling only token_hash sent every stock-template signup to
  // /login?error=confirm.
  it("exchanges a PKCE code for a session and redirects home", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(confirmRequest("?code=pkce-code"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${BASE}/`);
  });

  it("honors the next param when exchanging a code", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(confirmRequest("?code=pkce-code&next=/players"));
    expect(response.headers.get("location")).toBe(`${BASE}/players`);
  });

  it("refuses to send an exchanged session off-origin", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(confirmRequest("?code=pkce-code&next=//evil.example"));
    expect(response.headers.get("location")).toBe(`${BASE}/`);
  });

  it("redirects to login when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });
    const response = await GET(confirmRequest("?code=nope"));
    expect(response.headers.get("location")).toBe(`${BASE}/login?error=confirm`);
  });

  it("redirects to login when Supabase reports an error instead of a code", async () => {
    const response = await GET(confirmRequest("?error=access_denied&error_code=otp_expired"));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${BASE}/login?error=confirm`);
  });
});
