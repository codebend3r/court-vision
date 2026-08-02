import { beforeEach, describe, expect, it, vi } from "bun:test";

const leagueFindMany = vi.fn();
const leagueFindFirst = vi.fn();
const leagueCreate = vi.fn();
const profileUpdate = vi.fn();
const getProfile = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findMany: leagueFindMany, findFirst: leagueFindFirst, create: leagueCreate },
    profile: { update: profileUpdate },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));

import {
  ensureDefaultLeague,
  fallbackActiveLeagueId,
  getActiveLeague,
  getLeagues,
  resolveActiveLeague,
  toLeagueSummary,
} from "@/lib/leagues/queries";
import { type LeagueSummary } from "@/lib/leagues/types";

const profile = {
  id: "prof-1",
  email: "a@b.com",
  username: "a",
  tier: "free",
  displayName: null,
  preferredFormula: null,
  fontScale: "default",
  activeLeagueId: "league-1",
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
};

const dbLeague = ({ id, slug, updatedAt }: { id: string; slug: string; updatedAt: Date }) => ({
  id,
  profileId: profile.id,
  name: "My League",
  slug,
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  createdAt: new Date("2026-07-01"),
  updatedAt,
});

beforeEach(() => {
  leagueFindMany.mockReset();
  leagueFindFirst.mockReset();
  leagueCreate.mockReset();
  profileUpdate.mockReset();
  getProfile.mockReset();

  getProfile.mockResolvedValue(profile);
  profileUpdate.mockResolvedValue({});
});

describe("toLeagueSummary", () => {
  it("falls back to h2h_categories for a stale/tampered scoringType", () => {
    const league = dbLeague({ id: "1", slug: "a", updatedAt: new Date("2026-07-01") });
    const summary = toLeagueSummary({ league: { ...league, scoringType: "junk" } });
    expect(summary.scoringType).toBe("h2h_categories");
  });
});

describe("getLeagues", () => {
  it("returns an empty array when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getLeagues()).toEqual([]);
    expect(leagueFindMany).not.toHaveBeenCalled();
  });

  it("scopes to the signed-in profile", async () => {
    leagueFindMany.mockResolvedValue([dbLeague({ id: "1", slug: "a", updatedAt: new Date() })]);
    const leagues = await getLeagues();
    expect(leagues).toHaveLength(1);
    expect(leagueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profileId: profile.id } }),
    );
  });
});

describe("resolveActiveLeague", () => {
  it("scopes the activeLeagueId pointer lookup by owner", async () => {
    leagueFindFirst.mockResolvedValue(
      dbLeague({ id: "league-1", slug: "a", updatedAt: new Date() }),
    );
    await resolveActiveLeague({ profile });
    expect(leagueFindFirst).toHaveBeenCalledWith({
      where: { id: "league-1", profileId: profile.id },
    });
  });

  it("falls through to the most-recently-updated owned league when the pointer misses", async () => {
    leagueFindFirst
      .mockResolvedValueOnce(null) // owner-scoped pointer lookup finds nothing
      .mockResolvedValueOnce(dbLeague({ id: "league-2", slug: "b", updatedAt: new Date() }));
    const league = await resolveActiveLeague({ profile });
    expect(league?.id).toBe("league-2");
    expect(leagueFindFirst).toHaveBeenLastCalledWith({
      where: { profileId: profile.id },
      orderBy: { updatedAt: "desc" },
    });
  });
});

describe("getActiveLeague", () => {
  it("returns null when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getActiveLeague()).toBeNull();
  });
});

describe("ensureDefaultLeague", () => {
  it("activates an existing league without a second write when already active", async () => {
    leagueFindFirst.mockResolvedValue(
      dbLeague({ id: "league-1", slug: "a", updatedAt: new Date() }),
    );
    const league = await ensureDefaultLeague({ profile });
    expect(league?.id).toBe("league-1");
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("points the pointer at a found league that wasn't active", async () => {
    const other = { ...profile, activeLeagueId: null };
    leagueFindFirst.mockResolvedValue(
      dbLeague({ id: "league-2", slug: "b", updatedAt: new Date() }),
    );
    const league = await ensureDefaultLeague({ profile: other });
    expect(league?.id).toBe("league-2");
    expect(profileUpdate).toHaveBeenCalledWith({
      where: { id: other.id },
      data: { activeLeagueId: "league-2" },
    });
  });

  it("creates the default league when none exists", async () => {
    leagueFindFirst.mockResolvedValue(null);
    leagueCreate.mockResolvedValue(
      dbLeague({ id: "new-league", slug: "my-league", updatedAt: new Date() }),
    );
    const league = await ensureDefaultLeague({ profile });
    expect(league?.id).toBe("new-league");
    expect(profileUpdate).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { activeLeagueId: "new-league" },
    });
  });

  // Two concurrent calls for the same profile both see "no league yet" and
  // both attempt the create; only one wins the profileId+slug unique
  // constraint. The loser must converge on the winner, not throw. Uses a
  // null activeLeagueId so each resolveActiveLeague call is a single
  // findFirst (no pointer branch), keeping the mock call sequence exact.
  it("converges on the winner when the create loses a P2002 race", async () => {
    const noPointer = { ...profile, activeLeagueId: null };
    leagueFindFirst
      .mockResolvedValueOnce(null) // first resolveActiveLeague: nothing yet
      .mockResolvedValueOnce(
        dbLeague({ id: "winner-league", slug: "my-league", updatedAt: new Date() }),
      ); // re-resolve after the race loss finds the winner
    leagueCreate.mockRejectedValue({ code: "P2002" });

    const league = await ensureDefaultLeague({ profile: noPointer });

    expect(league?.id).toBe("winner-league");
    expect(profileUpdate).toHaveBeenCalledWith({
      where: { id: noPointer.id },
      data: { activeLeagueId: "winner-league" },
    });
  });

  it("rethrows a non-unique-violation create error", async () => {
    leagueFindFirst.mockResolvedValue(null);
    leagueCreate.mockRejectedValue(new Error("connection reset"));
    await expect(ensureDefaultLeague({ profile })).rejects.toThrow("connection reset");
  });

  it("rethrows when the P2002 race loser still can't find a winner", async () => {
    leagueFindFirst.mockResolvedValue(null);
    leagueCreate.mockRejectedValue({ code: "P2002" });
    await expect(ensureDefaultLeague({ profile })).rejects.toEqual({ code: "P2002" });
  });

  it("returns null when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await ensureDefaultLeague()).toBeNull();
    expect(leagueFindFirst).not.toHaveBeenCalled();
  });
});

describe("fallbackActiveLeagueId", () => {
  const summary = ({ id, updatedAt }: { id: string; updatedAt: string }): LeagueSummary => ({
    id,
    name: id,
    slug: id,
    scoringType: "h2h_categories",
    teamCount: 12,
    rosterSlots: 13,
    scoringConfig: { categories: ["pts"] },
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt,
  });

  it("keeps activeLeagueId when it's present in the list", () => {
    const leagues = [
      summary({ id: "a", updatedAt: "2026-07-01T00:00:00.000Z" }),
      summary({ id: "b", updatedAt: "2026-07-05T00:00:00.000Z" }),
    ];
    expect(fallbackActiveLeagueId({ leagues, activeLeagueId: "a" })).toBe("a");
  });

  it("falls back to the most-recently-updated league, matching resolveActiveLeague", () => {
    const leagues = [
      summary({ id: "a", updatedAt: "2026-07-01T00:00:00.000Z" }),
      summary({ id: "b", updatedAt: "2026-07-05T00:00:00.000Z" }),
      summary({ id: "c", updatedAt: "2026-07-03T00:00:00.000Z" }),
    ];
    expect(fallbackActiveLeagueId({ leagues, activeLeagueId: null })).toBe("b");
    expect(fallbackActiveLeagueId({ leagues, activeLeagueId: "missing" })).toBe("b");
  });

  it("returns null for an empty list", () => {
    expect(fallbackActiveLeagueId({ leagues: [], activeLeagueId: null })).toBeNull();
  });
});
