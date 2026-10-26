import { beforeEach, describe, expect, it, vi } from "bun:test";

const leagueFindMany = vi.fn();
const leagueFindFirst = vi.fn();
const leagueCreate = vi.fn();
const profileUpdate = vi.fn();
const getProfile = vi.fn();

const tx = {
  league: { findMany: leagueFindMany, findFirst: leagueFindFirst, create: leagueCreate },
  profile: { update: profileUpdate },
};
type TestTransaction<T> = (client: typeof tx) => Promise<T>;
const lockProfile = vi.fn();
vi.mock("@/lib/leagues/locks", () => ({ lockProfile }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findMany: leagueFindMany, findFirst: leagueFindFirst, create: leagueCreate },
    profile: { update: profileUpdate },
    $transaction: <T>(run: TestTransaction<T>) => run(tx),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));

import {
  ensureDefaultLeague,
  fallbackActiveLeagueId,
  getActiveLeague,
  getActiveLeagueRecord,
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

type DbLeagueProps = { id: string; slug: string; updatedAt: Date };

const dbLeague = ({ id, slug, updatedAt }: DbLeagueProps) => ({
  id,
  profileId: profile.id,
  name: "My League",
  slug,
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  provider: "manual",
  externalKey: null,
  externalUrl: null,
  syncVia: "server",
  myTeamId: null,
  syncedAt: null,
  syncStartedAt: null,
  syncLeaseUntil: null,
  syncError: null,
  unsupportedCategories: [],
  statCategories: null,
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
  lockProfile.mockReset();
  lockProfile.mockImplementation(async () => ({
    activeLeagueId: (await getProfile()).activeLeagueId,
  }));
  profileUpdate.mockResolvedValue({});
});

describe("toLeagueSummary", () => {
  it("falls back to h2h_categories for a stale/tampered scoringType", () => {
    const league = dbLeague({ id: "1", slug: "a", updatedAt: new Date("2026-07-01") });
    const summary = toLeagueSummary({ league: { ...league, scoringType: "junk" } });
    expect(summary.scoringType).toBe("h2h_categories");
  });

  it("maps provider, sync fields and unsupported categories into the summary", () => {
    const league = dbLeague({ id: "1", slug: "a", updatedAt: new Date("2026-07-01") });
    const summary = toLeagueSummary({
      league: {
        ...league,
        provider: "yahoo",
        externalKey: "466.l.1234",
        externalUrl: "https://basketball.fantasysports.yahoo.com/nba/1234",
        myTeamId: "team-3",
        syncedAt: new Date("2026-10-16T12:00:00.000Z"),
        syncError: "token expired",
        unsupportedCategories: ["DD", "TD"],
      },
    });
    expect(summary).toMatchObject({
      provider: "yahoo",
      externalUrl: "https://basketball.fantasysports.yahoo.com/nba/1234",
      myTeamId: "team-3",
      syncedAt: "2026-10-16T12:00:00.000Z",
      syncError: "token expired",
      unsupportedCategories: ["DD", "TD"],
    });
  });

  it("reads a hand-built league's empty sync fields as nulls", () => {
    const league = dbLeague({ id: "1", slug: "a", updatedAt: new Date("2026-07-01") });
    expect(toLeagueSummary({ league })).toMatchObject({
      provider: "manual",
      externalUrl: null,
      myTeamId: null,
      syncedAt: null,
      syncError: null,
      unsupportedCategories: [],
    });
  });

  it("reads an unknown stored provider as manual for display but still imported", () => {
    const league = dbLeague({ id: "1", slug: "a", updatedAt: new Date("2026-07-01") });
    expect(toLeagueSummary({ league: { ...league, provider: "espn" } })).toMatchObject({
      provider: "manual",
      isImported: true,
    });
  });

  it("maps syncVia into the summary, defaulting to server", () => {
    const league = dbLeague({ id: "1", slug: "a", updatedAt: new Date("2026-07-01") });
    expect(toLeagueSummary({ league }).syncVia).toBe("server");
    expect(toLeagueSummary({ league: { ...league, syncVia: "extension" } }).syncVia).toBe(
      "extension",
    );
    expect(toLeagueSummary({ league: { ...league, syncVia: "browser" } }).syncVia).toBe("server");
  });

  it("marks only a hand-built league as not imported", () => {
    const league = dbLeague({ id: "1", slug: "a", updatedAt: new Date("2026-07-01") });
    expect(toLeagueSummary({ league }).isImported).toBe(false);
    expect(toLeagueSummary({ league: { ...league, provider: "yahoo" } }).isImported).toBe(true);
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
    expect(league?.id ?? null).toBe("league-2");
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

describe("getActiveLeagueRecord", () => {
  it("returns null without querying when signed out", async () => {
    getProfile.mockResolvedValue(null);
    expect(await getActiveLeagueRecord()).toBeNull();
    expect(leagueFindFirst).not.toHaveBeenCalled();
  });

  it("resolves the session profile's active league row", async () => {
    const league = dbLeague({ id: "league-1", slug: "a", updatedAt: new Date() });
    leagueFindFirst.mockResolvedValue(league);
    expect(await getActiveLeagueRecord()).toBe(league);
    expect(leagueFindFirst).toHaveBeenCalledWith({
      where: { id: "league-1", profileId: profile.id },
    });
  });
});

describe("ensureDefaultLeague", () => {
  it("activates an existing league without a second write when already active", async () => {
    leagueFindFirst.mockResolvedValue(
      dbLeague({ id: "league-1", slug: "a", updatedAt: new Date() }),
    );
    const league = await ensureDefaultLeague({ profile });
    expect(league?.id ?? null).toBe("league-1");
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it("points the pointer at a found league that wasn't active", async () => {
    const other = { ...profile, activeLeagueId: null };
    lockProfile.mockResolvedValue({ activeLeagueId: null });
    leagueFindFirst.mockResolvedValue(
      dbLeague({ id: "league-2", slug: "b", updatedAt: new Date() }),
    );
    const league = await ensureDefaultLeague({ profile: other });
    expect(league?.id ?? null).toBe("league-2");
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
    expect(league?.id ?? null).toBe("new-league");
    expect(profileUpdate).toHaveBeenCalledWith({
      where: { id: profile.id },
      data: { activeLeagueId: "new-league" },
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
  type SummaryProps = { id: string; updatedAt: string };

  const summary = ({ id, updatedAt }: SummaryProps): LeagueSummary => ({
    id,
    name: id,
    slug: id,
    scoringType: "h2h_categories",
    teamCount: 12,
    rosterSlots: 13,
    scoringConfig: { categories: ["pts"] },
    provider: "manual",
    syncVia: "server",
    isImported: false,
    externalUrl: null,
    myTeamId: null,
    syncedAt: null,
    syncError: null,
    unsupportedCategories: [],
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
