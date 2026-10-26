import { describe, expect, it, vi } from "bun:test";
import type { Profile } from "@generated/prisma/client";

import { withProfile } from "@/lib/auth/withProfile";

const profile: Profile = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "steve@example.com",
  username: "steve",
  tier: "free",
  displayName: null,
  preferredFormula: null,
  fontScale: "default",
  activeLeagueId: null,
  createdAt: new Date("2026-07-31"),
  updatedAt: new Date("2026-07-31"),
};

describe("withProfile", () => {
  it("runs the body with the resolved profile and returns its result", async () => {
    type RunFnProps = { profile: Profile };

    const run = vi.fn(async ({ profile: given }: RunFnProps) => ({
      status: "ok",
      id: given.id,
    }));

    expect(await withProfile({ getProfile: async () => profile, run })).toEqual({
      status: "ok",
      id: profile.id,
    });
    expect(run).toHaveBeenCalledWith({ profile });
  });

  it("answers unauthenticated without running the body when signed out", async () => {
    const run = vi.fn(async () => ({ status: "ok" }));

    expect(await withProfile({ getProfile: async () => null, run })).toEqual({
      status: "unauthenticated",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("reports error when the body throws", async () => {
    expect(
      await withProfile({
        getProfile: async () => profile,
        run: async () => {
          throw new Error("db down");
        },
      }),
    ).toEqual({ status: "error" });
  });

  it("reports error (not a rejection) when the session lookup throws", async () => {
    const run = vi.fn(async () => ({ status: "ok" }));

    expect(
      await withProfile({
        getProfile: async () => {
          throw new Error("auth down");
        },
        run,
      }),
    ).toEqual({ status: "error" });
    expect(run).not.toHaveBeenCalled();
  });
});
