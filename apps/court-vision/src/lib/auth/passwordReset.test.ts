import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { restoreEnv, stubEnv } from "@vision/testing/env";

const resetFn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail: resetFn } }),
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => null }),
}));

import { requestPasswordReset } from "@/lib/auth/passwordReset";

describe("requestPasswordReset", () => {
  beforeEach(() => {
    resetFn.mockReset();
    ["NEXT_PUBLIC_SITE_URL", "DEPLOY_PRIME_URL", "URL"].forEach((key) =>
      stubEnv({ key, value: "" }),
    );
  });

  afterEach(() => {
    restoreEnv();
  });

  it("rejects an invalid email before hitting Supabase", async () => {
    const result = await requestPasswordReset({ email: "nope" });
    expect(result).toEqual({ ok: false, error: "Enter a valid email." });
    expect(resetFn).not.toHaveBeenCalled();
  });

  it("sends a link that returns through the confirm route to the reset form", async () => {
    stubEnv({ key: "URL", value: "https://court-vizion.netlify.app" });
    resetFn.mockResolvedValue({ error: null });

    const result = await requestPasswordReset({ email: "a@b.com" });

    expect(result).toEqual({ ok: true });
    expect(resetFn).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "https://court-vizion.netlify.app/auth/confirm?next=%2Freset-password",
    });
  });

  it("surfaces a Supabase failure", async () => {
    resetFn.mockResolvedValue({ error: { message: "For security purposes, wait 47 seconds" } });
    const result = await requestPasswordReset({ email: "a@b.com" });
    expect(result).toEqual({ ok: false, error: "For security purposes, wait 47 seconds" });
  });
});
