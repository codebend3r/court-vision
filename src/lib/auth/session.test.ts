import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { profile: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { getProfile } from "./session";

describe("getProfile", () => {
  beforeEach(() => {
    getUser.mockReset();
    findUnique.mockReset();
    // Default to a configured Supabase so getUser reaches the (mocked) client.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("returns null without touching auth when Supabase is unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
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
