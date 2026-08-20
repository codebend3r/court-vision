import { afterAll, beforeEach, describe, expect, it, vi } from "bun:test";

import { restoreEnv, stubEnv } from "@/lib/testing/env";

const getUser = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { profile: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { getProfile } from "@/lib/auth/session";

describe("getProfile", () => {
  beforeEach(() => {
    getUser.mockReset();
    findUnique.mockReset();
    // Default to a configured Supabase so getUser reaches the (mocked) client.
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_URL", value: "https://example.supabase.co" });
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: "sb_publishable_test" });
  });

  afterAll(() => {
    restoreEnv();
  });

  it("returns null without touching auth when Supabase is unconfigured", async () => {
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_URL", value: "" });
    stubEnv({ key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: "" });
    expect(await getProfile()).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns null when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getProfile()).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("looks up the profile by auth user id", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "uuid-1" } } });
    findUnique.mockResolvedValue({ id: "uuid-1", username: "steve", tier: "free" });
    const profile = await getProfile();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "uuid-1" } });
    expect(profile?.username).toBe("steve");
  });
});
