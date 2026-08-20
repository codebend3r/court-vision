import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { restoreEnv, stubEnv } from "@/lib/testing/env";

const signUpFn = vi.fn();
const resendFn = vi.fn();
const findFirst = vi.fn();
const getHeader = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: signUpFn, resend: resendFn } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { profile: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => getHeader(name) }),
}));

import { resendConfirmation, signUp } from "@/lib/auth/signup";

describe("signUp", () => {
  beforeEach(() => {
    signUpFn.mockReset();
    resendFn.mockReset();
    findFirst.mockReset();
    getHeader.mockReset();
    getHeader.mockReturnValue(null);
    // Netlify sets these in CI; blank them so a case that doesn't set one is
    // testing the fallback it means to test.
    ["NEXT_PUBLIC_SITE_URL", "DEPLOY_PRIME_URL", "URL"].forEach((key) =>
      stubEnv({ key, value: "" }),
    );
  });

  afterEach(() => {
    restoreEnv();
  });

  it("rejects an invalid username before hitting Supabase", async () => {
    const result = await signUp({ email: "a@b.com", username: "no", password: "password123" });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("at least 3") });
    expect(signUpFn).not.toHaveBeenCalled();
  });

  it("rejects a taken username", async () => {
    findFirst.mockResolvedValue({ id: "x" });
    const result = await signUp({ email: "a@b.com", username: "steve", password: "password123" });
    expect(result).toEqual({ ok: false, error: "That username is taken." });
    expect(signUpFn).not.toHaveBeenCalled();
  });

  it("maps a Supabase unique violation to the taken message", async () => {
    findFirst.mockResolvedValue(null);
    signUpFn.mockResolvedValue({
      error: { message: "duplicate key value violates unique constraint" },
    });
    const result = await signUp({ email: "a@b.com", username: "steve", password: "password123" });
    expect(result).toEqual({ ok: false, error: "That username is taken." });
  });

  it("succeeds on a clean signup", async () => {
    findFirst.mockResolvedValue(null);
    signUpFn.mockResolvedValue({ error: null });
    const result = await signUp({ email: "a@b.com", username: "steve", password: "password123" });
    expect(result).toEqual({ ok: true });
    expect(signUpFn).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "password123",
      options: {
        data: { username: "steve" },
        emailRedirectTo: "http://localhost:3000/auth/confirm",
      },
    });
  });

  // The bug this guards: with no emailRedirectTo, Supabase falls back to the
  // project's Site URL, so a production signup mails a localhost link.
  it("points the confirmation link at the deployed origin", async () => {
    stubEnv({ key: "URL", value: "https://court-vizion.netlify.app" });
    findFirst.mockResolvedValue(null);
    signUpFn.mockResolvedValue({ error: null });

    await signUp({ email: "a@b.com", username: "steve", password: "password123" });

    expect(signUpFn.mock.calls[0]?.[0]?.options?.emailRedirectTo).toBe(
      "https://court-vizion.netlify.app/auth/confirm",
    );
  });

  it("uses the request origin when no deployment URL is configured", async () => {
    getHeader.mockImplementation((name: string) =>
      name === "origin" ? "http://localhost:46644" : null,
    );
    findFirst.mockResolvedValue(null);
    signUpFn.mockResolvedValue({ error: null });

    await signUp({ email: "a@b.com", username: "steve", password: "password123" });

    expect(getHeader).toHaveBeenCalledWith("origin");
    expect(signUpFn.mock.calls[0]?.[0]?.options?.emailRedirectTo).toBe(
      "http://localhost:46644/auth/confirm",
    );
  });
});

describe("resendConfirmation", () => {
  beforeEach(() => {
    resendFn.mockReset();
    getHeader.mockReset();
    getHeader.mockReturnValue(null);
    ["NEXT_PUBLIC_SITE_URL", "DEPLOY_PRIME_URL", "URL"].forEach((key) =>
      stubEnv({ key, value: "" }),
    );
  });

  afterEach(() => {
    restoreEnv();
  });

  it("rejects an invalid email before hitting Supabase", async () => {
    const result = await resendConfirmation({ email: "not-an-email" });
    expect(result).toEqual({ ok: false, error: "Enter a valid email." });
    expect(resendFn).not.toHaveBeenCalled();
  });

  it("re-sends the signup confirmation to a reachable origin", async () => {
    stubEnv({ key: "URL", value: "https://court-vizion.netlify.app" });
    resendFn.mockResolvedValue({ error: null });

    const result = await resendConfirmation({ email: "a@b.com" });

    expect(result).toEqual({ ok: true });
    expect(resendFn).toHaveBeenCalledWith({
      type: "signup",
      email: "a@b.com",
      options: { emailRedirectTo: "https://court-vizion.netlify.app/auth/confirm" },
    });
  });

  it("surfaces a Supabase failure", async () => {
    resendFn.mockResolvedValue({ error: { message: "For security purposes, wait 47 seconds" } });
    const result = await resendConfirmation({ email: "a@b.com" });
    expect(result).toEqual({ ok: false, error: "For security purposes, wait 47 seconds" });
  });
});
