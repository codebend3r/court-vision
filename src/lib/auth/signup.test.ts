import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpFn = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: signUpFn } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { profile: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

import { signUp } from "./signup";

describe("signUp", () => {
  beforeEach(() => {
    signUpFn.mockReset();
    findFirst.mockReset();
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
      options: { data: { username: "steve" } },
    });
  });
});
