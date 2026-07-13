import { beforeEach, describe, expect, it, vi } from "vitest";

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
