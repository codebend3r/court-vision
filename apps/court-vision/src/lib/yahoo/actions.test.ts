import { beforeEach, describe, expect, it, vi } from "bun:test";

import { type League } from "@generated/prisma/client";
import { type YahooLoadResult } from "@/lib/yahoo/load";
import { type ResolvedPlayers } from "@/lib/yahoo/matchPlayers";
import { type ImportedLeague, type YahooPlayerRef } from "@/lib/yahoo/types";

type LoadArgs = { leagueId: string; includeWaivers?: boolean };
type ResolveArgs = { refs: readonly YahooPlayerRef[]; writeMappings: boolean };

const claimSync = vi.fn<() => Promise<Date | null>>(async () => new Date("2026-10-26T00:00:00Z"));
const releaseSync = vi.fn(async () => {});
vi.mock("@/lib/yahoo/syncLease", () => ({ claimSync, releaseSync }));
const getProfile = vi.fn();
const loadYahooLeague = vi.fn<(args: LoadArgs) => Promise<YahooLoadResult>>();
const resolveYahooPlayers = vi.fn<(args: ResolveArgs) => Promise<ResolvedPlayers>>();
type CreateImportedLeagueProps = { myTeamExternalKey: string };

const createImportedLeague = vi.fn<(args: CreateImportedLeagueProps) => Promise<League>>();
type SyncImportedLeagueProps = { leagueId: string };

const syncImportedLeague = vi.fn<(args: SyncImportedLeagueProps) => Promise<League>>();

const leagueFindFirst = vi.fn();
const leagueUpdate = vi.fn();
const leagueCount = vi.fn<() => Promise<number>>();
const teamFindFirst = vi.fn();
const $transaction = vi.fn();
// The transaction's own delegate, so a test can tell a read made inside the
// transaction from one made outside it.
const txFindFirst = vi.fn();
const txCount = vi.fn<() => Promise<number>>();

const leagueDelegate = {
  findFirst: leagueFindFirst,
  update: leagueUpdate,
  updateMany: leagueUpdate,
  count: leagueCount,
};
const lockProfile = vi.fn(async () => ({ activeLeagueId: null }));
vi.mock("@/lib/leagues/locks", () => ({ lockProfile }));
const tx = { league: { findFirst: txFindFirst, count: txCount } };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: leagueDelegate,
    leagueTeam: { findFirst: teamFindFirst },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => {
      $transaction();
      return fn(tx);
    }),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));
vi.mock("@/lib/yahoo/load", () => ({ loadYahooLeague }));
vi.mock("@/lib/yahoo/matchPlayers", () => ({ resolveYahooPlayers }));
vi.mock("@/lib/yahoo/persist", () => ({ createImportedLeague, syncImportedLeague }));

import {
  importYahooLeague,
  previewYahooLeague,
  setMyTeam,
  syncYahooLeague,
} from "@/lib/yahoo/actions";

const PROFILE_ID = "prof-1";
const LEAGUE_ID = "league-1";
const LEAGUE_URL = "https://basketball.fantasysports.yahoo.com/nba/106344";
const MY_TEAM = "478.l.106344.t.5";
const OTHER_TEAM = "478.l.106344.t.6";
const UNAVAILABLE_MESSAGE = "Yahoo isn't answering right now; try again in a minute.";

const profile = { id: PROFILE_ID, activeLeagueId: null };

type RefProps = { id: string; name: string };

const ref = ({ id, name }: RefProps): YahooPlayerRef => ({
  yahooPlayerId: id,
  fullName: name,
  teamAbbr: "NYK",
  eligiblePositions: ["PG"],
  displayPosition: null,
  status: null,
});

const BRUNSON = ref({ id: "6404", name: "Jalen Brunson" });
const HART = ref({ id: "6505", name: "Josh Hart" });
const NOBODY = ref({ id: "9999", name: "Nobody Known" });
const WAIVER = ref({ id: "7000", name: "Waiver Guy" });

const importedLeague: ImportedLeague = {
  statCategories: [],
  matchups: null,
  externalKey: "478.l.106344",
  externalUrl: LEAGUE_URL,
  name: "Game of Courts",
  logoUrl: "https://s.yimg.com/logo.png",
  season: 2026,
  teamCount: 12,
  rosterSlots: 13,
  scoring: {
    scoringType: "h2h_categories",
    scoringConfig: { categories: ["pts", "reb", "ast"] },
    unsupportedCategories: ["DD"],
  },
  teams: [
    {
      externalKey: MY_TEAM,
      name: "Newfoundlanders",
      logoUrl: null,
      managerName: "CJ",
      isOwnedByCurrentLogin: false,
      slots: [
        { slotType: "PG", player: BRUNSON },
        { slotType: "SG", player: NOBODY },
        { slotType: "BENCH", player: null },
      ],
    },
    {
      externalKey: OTHER_TEAM,
      name: "Better Call Gasol",
      logoUrl: "https://s.yimg.com/team.png",
      managerName: null,
      isOwnedByCurrentLogin: false,
      slots: [{ slotType: "PG", player: HART }],
    },
  ],
};

const leagueRow: League = {
  id: LEAGUE_ID,
  profileId: PROFILE_ID,
  name: "Game of Courts",
  slug: "game-of-courts",
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts", "reb", "ast"] },
  provider: "yahoo",
  syncVia: "server",
  externalKey: "478.l.106344",
  externalUrl: LEAGUE_URL,
  myTeamId: "team-5",
  syncedAt: new Date("2026-10-17T12:00:00Z"),
  syncStartedAt: null,
  syncLeaseUntil: null,
  syncError: null,
  unsupportedCategories: ["DD"],
  statCategories: null,
  createdAt: new Date("2026-10-17T12:00:00Z"),
  updatedAt: new Date("2026-10-17T12:00:00Z"),
};

const loaded: YahooLoadResult = { status: "ok", league: importedLeague, waiverRefs: [WAIVER] };
const resolved: ResolvedPlayers = {
  byYahooId: new Map([
    ["6404", 1],
    ["6505", 2],
  ]),
  unmatched: [NOBODY, WAIVER],
};

type SecondsAgoProps = { seconds: number };

const secondsAgo = ({ seconds }: SecondsAgoProps): Date => new Date(Date.now() - seconds * 1000);

type StoredLeague = {
  provider: string;
  syncVia: string;
  externalKey: string | null;
  syncedAt: Date | null;
  syncError: string | null;
  updatedAt: Date;
};

// The row `syncYahooLeague` reads: an imported league last synced 5 minutes ago.
const storedLeague = (overrides: Partial<StoredLeague> = {}): StoredLeague => ({
  provider: "yahoo",
  syncVia: "server",
  externalKey: "478.l.106344",
  syncedAt: secondsAgo({ seconds: 300 }),
  syncError: null,
  updatedAt: secondsAgo({ seconds: 300 }),
  ...overrides,
});

type ExpectSyncErrorProps = { message: string };

const expectSyncError = ({ message }: ExpectSyncErrorProps) => {
  expect(leagueUpdate).toHaveBeenCalledTimes(1);
  expect(leagueUpdate).toHaveBeenCalledWith({
    where: {
      id: LEAGUE_ID,
      profileId: PROFILE_ID,
      syncStartedAt: new Date("2026-10-26T00:00:00Z"),
    },
    data: { syncError: message },
  });
};

const expectNoWrites = () => {
  expect(resolveYahooPlayers).not.toHaveBeenCalled();
  expect(createImportedLeague).not.toHaveBeenCalled();
  expect(syncImportedLeague).not.toHaveBeenCalled();
  expect(leagueUpdate).not.toHaveBeenCalled();
  expect($transaction).not.toHaveBeenCalled();
};

beforeEach(() => {
  [
    getProfile,
    loadYahooLeague,
    resolveYahooPlayers,
    createImportedLeague,
    syncImportedLeague,
    leagueFindFirst,
    txFindFirst,
    txCount,
    leagueUpdate,
    leagueCount,
    teamFindFirst,
    $transaction,
  ].forEach((double) => double.mockReset());

  getProfile.mockResolvedValue(profile);
  loadYahooLeague.mockResolvedValue(loaded);
  resolveYahooPlayers.mockResolvedValue(resolved);
  createImportedLeague.mockResolvedValue(leagueRow);
  syncImportedLeague.mockResolvedValue(leagueRow);
  leagueFindFirst.mockResolvedValue(null);
  txFindFirst.mockResolvedValue(null);
  txCount.mockResolvedValue(0);
  leagueCount.mockResolvedValue(0);
  leagueUpdate.mockResolvedValue(leagueRow);
  teamFindFirst.mockResolvedValue({ id: "team-6" });
});

describe("every action", () => {
  it("answers unauthenticated for every action without a profile", async () => {
    getProfile.mockResolvedValue(null);

    expect(await previewYahooLeague({ url: LEAGUE_URL })).toEqual({ status: "unauthenticated" });
    expect(await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM })).toEqual({
      status: "unauthenticated",
    });
    expect(await syncYahooLeague({ leagueId: LEAGUE_ID })).toEqual({ status: "unauthenticated" });
    expect(await setMyTeam({ leagueId: LEAGUE_ID, teamId: "team-6" })).toEqual({
      status: "unauthenticated",
    });
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expect(leagueFindFirst).not.toHaveBeenCalled();
    expect(teamFindFirst).not.toHaveBeenCalled();
  });

  // Annotations are erased: an object here would reach a `where` as a Prisma
  // filter, so the guard runs before the session or the database is touched.
  it("rejects non-string arguments before any query", async () => {
    // @ts-expect-error Simulate an object arriving from a forged request body.
    expect(await previewYahooLeague({ url: { not: "" } })).toEqual({ status: "invalid_url" });
    // @ts-expect-error Simulate an object arriving from a forged request body.
    expect(await importYahooLeague({ url: { not: "" }, myTeamExternalKey: MY_TEAM })).toEqual({
      status: "invalid_url",
    });
    // @ts-expect-error Simulate an object arriving from a forged request body.
    expect(await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: {} })).toEqual({
      status: "invalid_team",
    });
    // @ts-expect-error Simulate an object arriving from a forged request body.
    expect(await syncYahooLeague({ leagueId: {} })).toEqual({ status: "error" });
    // @ts-expect-error Simulate an object arriving from a forged request body.
    expect(await setMyTeam({ leagueId: {}, teamId: "team-6" })).toEqual({ status: "invalid" });
    // @ts-expect-error Simulate an object arriving from a forged request body.
    expect(await setMyTeam({ leagueId: LEAGUE_ID, teamId: { not: "" } })).toEqual({
      status: "invalid",
    });

    expect(getProfile).not.toHaveBeenCalled();
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expect(leagueFindFirst).not.toHaveBeenCalled();
    expect(teamFindFirst).not.toHaveBeenCalled();
    expectNoWrites();
  });
});

describe("previewYahooLeague", () => {
  it("maps URL and load failures to their statuses", async () => {
    expect(await previewYahooLeague({ url: "not a league" })).toEqual({ status: "invalid_url" });
    expect(
      await previewYahooLeague({ url: "https://hockey.fantasysports.yahoo.com/hockey/1" }),
    ).toEqual({ status: "wrong_sport" });
    expect(
      await previewYahooLeague({ url: "https://basketball.fantasysports.yahoo.com/2024/nba/1" }),
    ).toEqual({ status: "past_season" });
    expect(loadYahooLeague).not.toHaveBeenCalled();

    const cases: [YahooLoadResult, string][] = [
      [{ status: "past_season" }, "past_season"],
      [{ status: "not_found" }, "not_found"],
      [{ status: "unavailable" }, "unavailable"],
      [{ status: "invalid_payload" }, "invalid_payload"],
      [{ status: "unsupported", reason: "highscore" }, "highscore"],
      [{ status: "unsupported", reason: "scoring_type" }, "unsupported_scoring"],
    ];
    const results = await cases.reduce<Promise<string[]>>(async (previous, [load]) => {
      const statuses = await previous;
      loadYahooLeague.mockResolvedValueOnce(load);
      const result = await previewYahooLeague({ url: LEAGUE_URL });
      return [...statuses, result.status];
    }, Promise.resolve([]));

    expect(results).toEqual(cases.map(([, status]) => status));
    expect(loadYahooLeague).toHaveBeenCalledWith({ leagueId: "106344", includeWaivers: false });
  });

  it("previews without writing anything", async () => {
    const result = await previewYahooLeague({ url: LEAGUE_URL });

    expect(result).toEqual({
      status: "ok",
      preview: {
        name: "Game of Courts",
        logoUrl: "https://s.yimg.com/logo.png",
        meta: "12-team · 3-cat",
        unsupportedCategories: ["DD"],
        teams: [
          {
            externalKey: MY_TEAM,
            name: "Newfoundlanders",
            logoUrl: null,
            managerName: "CJ",
            rosterCount: 2,
            isOwnedByCurrentLogin: false,
          },
          {
            externalKey: OTHER_TEAM,
            name: "Better Call Gasol",
            logoUrl: "https://s.yimg.com/team.png",
            managerName: null,
            rosterCount: 1,
            isOwnedByCurrentLogin: false,
          },
        ],
      },
    });
    expect(leagueFindFirst).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("answers error when the load throws", async () => {
    loadYahooLeague.mockRejectedValueOnce(new Error("boom"));

    expect(await previewYahooLeague({ url: LEAGUE_URL })).toEqual({ status: "error" });
  });
});

describe("importYahooLeague", () => {
  it("maps URL and load failures to their statuses", async () => {
    expect(await importYahooLeague({ url: "nope", myTeamExternalKey: MY_TEAM })).toEqual({
      status: "invalid_url",
    });
    loadYahooLeague.mockResolvedValueOnce({ status: "unsupported", reason: "highscore" });
    expect(await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM })).toEqual({
      status: "highscore",
    });
    expectNoWrites();
  });

  it("refuses a duplicate before matching any players", async () => {
    leagueFindFirst.mockResolvedValueOnce({ slug: "game-of-courts" });

    const result = await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM });

    expect(result).toEqual({ status: "duplicate", slug: "game-of-courts" });
    expect(leagueFindFirst).toHaveBeenCalledWith({
      where: { profileId: PROFILE_ID, provider: "yahoo", externalKey: "478.l.106344" },
      select: { slug: true },
    });
    expectNoWrites();
  });

  it("refuses an eleventh league before matching any players", async () => {
    leagueCount.mockResolvedValueOnce(10);

    const result = await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM });

    expect(result).toEqual({ status: "limit" });
    expect(leagueCount).toHaveBeenCalledWith({ where: { profileId: PROFILE_ID } });
    expectNoWrites();
  });

  it("rechecks for a duplicate inside the transaction and returns the existing slug", async () => {
    txFindFirst.mockResolvedValueOnce({ slug: "game-of-courts" });

    const result = await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM });

    expect(result).toEqual({ status: "duplicate", slug: "game-of-courts" });
    expect(txFindFirst).toHaveBeenCalledWith({
      where: { profileId: PROFILE_ID, provider: "yahoo", externalKey: "478.l.106344" },
      select: { slug: true },
    });
    expect(leagueFindFirst).toHaveBeenCalledTimes(1);
    expect(createImportedLeague).not.toHaveBeenCalled();
  });

  it("reports a duplicate when a concurrent import wins the unique constraint", async () => {
    createImportedLeague.mockRejectedValueOnce(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );
    // The early check finds nothing; the lookup after the violation finds the winner.
    leagueFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ slug: "game-of-courts" });

    const result = await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM });

    expect(result).toEqual({ status: "duplicate", slug: "game-of-courts" });
    expect(leagueFindFirst).toHaveBeenLastCalledWith({
      where: { profileId: PROFILE_ID, provider: "yahoo", externalKey: "478.l.106344" },
      select: { slug: true },
    });
  });

  it("answers error when a unique violation has no existing import behind it", async () => {
    createImportedLeague.mockRejectedValueOnce(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    const result = await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM });

    expect(result).toEqual({ status: "error" });
    expect(leagueFindFirst).toHaveBeenCalledTimes(2);
  });

  it("rechecks the league cap inside the transaction", async () => {
    txCount.mockResolvedValueOnce(10);

    const result = await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM });

    expect(result).toEqual({ status: "limit" });
    expect(txCount).toHaveBeenCalledWith({ where: { profileId: PROFILE_ID } });
    expect(createImportedLeague).not.toHaveBeenCalled();
  });

  it("refuses a team key that isn't in the league", async () => {
    const result = await importYahooLeague({
      url: LEAGUE_URL,
      myTeamExternalKey: "478.l.999.t.1",
    });

    expect(result).toEqual({ status: "invalid_team" });
    expectNoWrites();
  });

  it("imports with server-side matching", async () => {
    const result = await importYahooLeague({ url: LEAGUE_URL, myTeamExternalKey: MY_TEAM });

    expect(loadYahooLeague).toHaveBeenCalledWith({ leagueId: "106344", includeWaivers: true });
    expect(resolveYahooPlayers).toHaveBeenCalledWith({
      refs: [BRUNSON, NOBODY, HART, WAIVER],
      writeMappings: true,
    });
    expect(createImportedLeague).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        profileId: PROFILE_ID,
        league: importedLeague,
        resolved,
        waiverRefs: [WAIVER],
        myTeamExternalKey: MY_TEAM,
      }),
    );
    expect(result).toEqual({
      status: "ok",
      league: expect.objectContaining({ id: LEAGUE_ID, slug: "game-of-courts", isImported: true }),
      unmatched: ["Nobody Known", "Waiver Guy"],
    });
  });
});

describe("syncYahooLeague", () => {
  it("does not fetch or persist when another worker owns the sync", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague());
    claimSync.mockResolvedValueOnce(null);
    expect(await syncYahooLeague({ leagueId: LEAGUE_ID })).toEqual({ status: "throttled" });
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expect(syncImportedLeague).not.toHaveBeenCalled();
  });
  it("throttles a sync within 60 seconds", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague({ syncedAt: secondsAgo({ seconds: 30 }) }));

    const result = await syncYahooLeague({ leagueId: LEAGUE_ID });

    expect(result).toEqual({ status: "throttled" });
    expect(leagueFindFirst).toHaveBeenCalledWith({
      where: { id: LEAGUE_ID, profileId: PROFILE_ID },
      select: {
        provider: true,
        syncVia: true,
        externalKey: true,
        syncedAt: true,
        syncError: true,
        updatedAt: true,
      },
    });
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expectNoWrites();
  });

  // A failure leaves `syncedAt` alone, so without this every page view would
  // re-sync for as long as Yahoo stays down.
  it("throttles a sync within 60 seconds of a failed one", async () => {
    leagueFindFirst.mockResolvedValueOnce(
      storedLeague({ syncError: UNAVAILABLE_MESSAGE, updatedAt: secondsAgo({ seconds: 10 }) }),
    );

    expect(await syncYahooLeague({ leagueId: LEAGUE_ID })).toEqual({ status: "throttled" });
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("does not throttle on a recent edit when the last sync succeeded", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague({ updatedAt: secondsAgo({ seconds: 10 }) }));

    expect(await syncYahooLeague({ leagueId: LEAGUE_ID })).toEqual(
      expect.objectContaining({ status: "ok" }),
    );
  });

  it("refuses to sync a manual league", async () => {
    leagueFindFirst.mockResolvedValueOnce(
      storedLeague({ provider: "manual", externalKey: null, syncedAt: null }),
    );

    expect(await syncYahooLeague({ leagueId: LEAGUE_ID })).toEqual({ status: "not_imported" });
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("refuses to sync an extension league from the server", async () => {
    // Synced a moment ago, so the throttle would answer if it ran first.
    leagueFindFirst.mockResolvedValueOnce(
      storedLeague({ syncVia: "extension", syncedAt: secondsAgo({ seconds: 5 }) }),
    );

    expect(await syncYahooLeague({ leagueId: LEAGUE_ID })).toEqual({ status: "needs_extension" });
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("refuses to sync a league with an unknown sync path from the server", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague({ syncVia: "espn" }));

    expect(await syncYahooLeague({ leagueId: LEAGUE_ID })).toEqual({ status: "needs_extension" });
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("refuses to sync a Yahoo league whose key has no league id", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague({ externalKey: "478-106344" }));

    expect(await syncYahooLeague({ leagueId: LEAGUE_ID })).toEqual({ status: "not_imported" });
    expect(loadYahooLeague).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("answers error for a league the caller doesn't own", async () => {
    expect(await syncYahooLeague({ leagueId: "forged" })).toEqual({ status: "error" });
    expect(loadYahooLeague).not.toHaveBeenCalled();
  });

  it("records the failure on the league and keeps its data", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague());
    loadYahooLeague.mockResolvedValueOnce({ status: "unavailable" });

    const result = await syncYahooLeague({ leagueId: LEAGUE_ID });

    expect(result).toEqual({ status: "unavailable" });
    expectSyncError({ message: UNAVAILABLE_MESSAGE });
    expect(resolveYahooPlayers).not.toHaveBeenCalled();
    expect(syncImportedLeague).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it("records a changed Yahoo key without touching the league's data", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague());
    loadYahooLeague.mockResolvedValueOnce({
      ...loaded,
      league: { ...importedLeague, externalKey: "499.l.106344" },
    });

    const result = await syncYahooLeague({ leagueId: LEAGUE_ID });

    expect(result).toEqual({ status: "error" });
    expectSyncError({ message: "This league's Yahoo key changed; import it again." });
    expect(resolveYahooPlayers).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it("records a write that fails after a good load", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague());
    syncImportedLeague.mockRejectedValueOnce(Object.assign(new Error("gone"), { code: "P2025" }));

    const result = await syncYahooLeague({ leagueId: LEAGUE_ID });

    expect(result).toEqual({ status: "error" });
    expectSyncError({ message: "Something went wrong. Try again." });
  });

  it("syncs an imported league from the id in its external key", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague());

    const result = await syncYahooLeague({ leagueId: LEAGUE_ID });

    expect(loadYahooLeague).toHaveBeenCalledWith({ leagueId: "106344" });
    expect(resolveYahooPlayers).toHaveBeenCalledWith({
      refs: [BRUNSON, NOBODY, HART, WAIVER],
      writeMappings: true,
    });
    expect(syncImportedLeague).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        profileId: PROFILE_ID,
        league: importedLeague,
        resolved,
        waiverRefs: [WAIVER],
        leagueId: LEAGUE_ID,
      }),
    );
    expect(leagueUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "ok",
      syncedAt: "2026-10-17T12:00:00.000Z",
      unmatched: ["Nobody Known", "Waiver Guy"],
    });
  });
});

describe("setMyTeam", () => {
  it("only sets my team to a team in that league", async () => {
    expect(await setMyTeam({ leagueId: LEAGUE_ID, teamId: "team-6" })).toEqual({ status: "ok" });
    expect(teamFindFirst).toHaveBeenCalledWith({
      where: {
        id: "team-6",
        leagueId: LEAGUE_ID,
        league: { profileId: PROFILE_ID, provider: "yahoo" },
      },
      select: { id: true },
    });
    expect(leagueUpdate).toHaveBeenCalledWith({
      where: { id: LEAGUE_ID, profileId: PROFILE_ID },
      data: { myTeamId: "team-6" },
    });

    leagueUpdate.mockClear();
    teamFindFirst.mockResolvedValueOnce(null);

    expect(await setMyTeam({ leagueId: LEAGUE_ID, teamId: "someone-elses" })).toEqual({
      status: "invalid",
    });
    expect(leagueUpdate).not.toHaveBeenCalled();
  });
});
