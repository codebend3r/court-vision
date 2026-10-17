import { beforeEach, describe, expect, it, vi } from "bun:test";

import { type League } from "@generated/prisma/client";
import { type LeagueSyncVia } from "@/lib/leagues/types";
import { type YahooLoadResult } from "@/lib/yahoo/load";
import { type ResolvedPlayers } from "@/lib/yahoo/matchPlayers";
import { type ImportedLeague, type YahooPlayerRef } from "@/lib/yahoo/types";

type ResolveArgs = { refs: readonly YahooPlayerRef[]; writeMappings: boolean };
type CreateArgs = { myTeamExternalKey: string; syncVia: LeagueSyncVia };

const loadYahooLeague = vi.fn<() => Promise<YahooLoadResult>>();
const resolveYahooPlayers = vi.fn<(args: ResolveArgs) => Promise<ResolvedPlayers>>();
const createImportedLeague = vi.fn<(args: CreateArgs) => Promise<League>>();
const syncImportedLeague = vi.fn<(args: { leagueId: string }) => Promise<League>>();

const leagueFindFirst = vi.fn();
const leagueUpdate = vi.fn();
const leagueCount = vi.fn<() => Promise<number>>();
const $transaction = vi.fn();
const txFindFirst = vi.fn();
const txCount = vi.fn<() => Promise<number>>();

const tx = { league: { findFirst: txFindFirst, count: txCount } };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findFirst: leagueFindFirst, update: leagueUpdate, count: leagueCount },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => {
      $transaction();
      return fn(tx);
    }),
  },
}));
vi.mock("@/lib/yahoo/load", () => ({ loadYahooLeague }));
vi.mock("@/lib/yahoo/matchPlayers", () => ({ resolveYahooPlayers }));
vi.mock("@/lib/yahoo/persist", () => ({ createImportedLeague, syncImportedLeague }));

import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import {
  importLoadedLeague,
  loadFailureToResult,
  readStoredSync,
  syncLoadedLeague,
  toYahooPreview,
} from "@/lib/yahoo/importLeague";
import { yahooLeagueSnapshotSchema } from "@/lib/yahoo/schemas";
import { toImportedLeague } from "@/lib/yahoo/transform";

const PROFILE_ID = "prof-1";
const LEAGUE_ID = "league-1";
const NEWFOUNDLANDERS = "478.l.106344.t.5";

const gameOfCourts = (): ImportedLeague => {
  const result = toImportedLeague({ snapshot: yahooLeagueSnapshotSchema.parse(league106344) });
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.reason}`);
  return result.league;
};

const WAIVER: YahooPlayerRef = {
  yahooPlayerId: "7000",
  fullName: "Waiver Guy",
  teamAbbr: "NYK",
  eligiblePositions: ["PG"],
  status: null,
};

const loaded = (): Extract<YahooLoadResult, { status: "ok" }> => ({
  status: "ok",
  league: gameOfCourts(),
  waiverRefs: [WAIVER],
});

const resolved: ResolvedPlayers = { byYahooId: new Map(), unmatched: [WAIVER] };

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
  syncVia: "extension",
  externalKey: "478.l.106344",
  externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
  myTeamId: "team-5",
  syncedAt: new Date("2026-10-17T12:00:00Z"),
  syncError: null,
  unsupportedCategories: [],
  createdAt: new Date("2026-10-17T12:00:00Z"),
  updatedAt: new Date("2026-10-17T12:00:00Z"),
};

const secondsAgo = ({ seconds }: { seconds: number }): Date =>
  new Date(Date.now() - seconds * 1000);

const expectNoWrites = () => {
  expect(resolveYahooPlayers).not.toHaveBeenCalled();
  expect(createImportedLeague).not.toHaveBeenCalled();
  expect(syncImportedLeague).not.toHaveBeenCalled();
  expect(leagueUpdate).not.toHaveBeenCalled();
  expect($transaction).not.toHaveBeenCalled();
};

beforeEach(() => {
  [
    loadYahooLeague,
    resolveYahooPlayers,
    createImportedLeague,
    syncImportedLeague,
    leagueFindFirst,
    leagueUpdate,
    leagueCount,
    $transaction,
    txFindFirst,
    txCount,
  ].forEach((double) => double.mockReset());

  resolveYahooPlayers.mockResolvedValue(resolved);
  createImportedLeague.mockResolvedValue(leagueRow);
  syncImportedLeague.mockResolvedValue(leagueRow);
  leagueFindFirst.mockResolvedValue(null);
  leagueCount.mockResolvedValue(0);
  leagueUpdate.mockResolvedValue(leagueRow);
  txFindFirst.mockResolvedValue(null);
  txCount.mockResolvedValue(0);
});

describe("toYahooPreview", () => {
  it("builds the preview from an imported league", () => {
    const preview = toYahooPreview({ league: gameOfCourts() });

    expect(preview.name).toBe("Game of Courts");
    expect(preview.meta).toBe("12-team · 9-cat");
    expect(preview.teams).toHaveLength(12);
    expect(preview.teams.find(({ externalKey }) => externalKey === NEWFOUNDLANDERS)).toEqual(
      expect.objectContaining({ name: "Newfoundlanders", rosterCount: 13 }),
    );
  });
});

describe("loadFailureToResult", () => {
  it("passes load failures through and splits an unsupported league by reason", () => {
    expect(loadFailureToResult({ failure: { status: "not_found" } })).toEqual({
      status: "not_found",
    });
    expect(loadFailureToResult({ failure: { status: "unavailable" } })).toEqual({
      status: "unavailable",
    });
    expect(loadFailureToResult({ failure: { status: "invalid_payload" } })).toEqual({
      status: "invalid_payload",
    });
    expect(loadFailureToResult({ failure: { status: "past_season" } })).toEqual({
      status: "past_season",
    });
    expect(
      loadFailureToResult({ failure: { status: "unsupported", reason: "highscore" } }),
    ).toEqual({ status: "highscore" });
    expect(
      loadFailureToResult({ failure: { status: "unsupported", reason: "scoring_type" } }),
    ).toEqual({ status: "unsupported_scoring" });
  });
});

describe("importLoadedLeague", () => {
  it("imports with the requested syncVia and mapping policy", async () => {
    const result = await importLoadedLeague({
      profileId: PROFILE_ID,
      loaded: loaded(),
      myTeamExternalKey: NEWFOUNDLANDERS,
      writeMappings: false,
      syncVia: "extension",
    });

    expect(resolveYahooPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ writeMappings: false }),
    );
    expect(resolveYahooPlayers.mock.calls[0]?.[0]?.refs.at(-1)).toEqual(WAIVER);
    expect(createImportedLeague).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        profileId: PROFILE_ID,
        myTeamExternalKey: NEWFOUNDLANDERS,
        syncVia: "extension",
      }),
    );
    expect(result).toEqual({
      status: "ok",
      league: expect.objectContaining({ id: LEAGUE_ID, syncVia: "extension" }),
      unmatched: ["Waiver Guy"],
    });
  });

  it("refuses a duplicate, the cap, and a team key outside the league", async () => {
    const importWith = ({ myTeamExternalKey }: { myTeamExternalKey: string }) =>
      importLoadedLeague({
        profileId: PROFILE_ID,
        loaded: loaded(),
        myTeamExternalKey,
        writeMappings: true,
        syncVia: "server",
      });

    leagueFindFirst.mockResolvedValueOnce({ slug: "game-of-courts" });
    expect(await importWith({ myTeamExternalKey: NEWFOUNDLANDERS })).toEqual({
      status: "duplicate",
      slug: "game-of-courts",
    });

    leagueCount.mockResolvedValueOnce(10);
    expect(await importWith({ myTeamExternalKey: NEWFOUNDLANDERS })).toEqual({ status: "limit" });

    expect(await importWith({ myTeamExternalKey: "478.l.999.t.1" })).toEqual({
      status: "invalid_team",
    });
    expectNoWrites();
  });
});

describe("readStoredSync", () => {
  const stored = ({ syncedAt }: { syncedAt: Date }) => ({
    provider: "yahoo",
    syncVia: "server",
    externalKey: "478.l.106344",
    syncedAt,
    syncError: null,
    updatedAt: syncedAt,
  });

  it("throttles a sync inside 60 seconds", async () => {
    leagueFindFirst.mockResolvedValueOnce(stored({ syncedAt: secondsAgo({ seconds: 30 }) }));
    expect(await readStoredSync({ profileId: PROFILE_ID, leagueId: LEAGUE_ID })).toEqual({
      status: "ok",
      league: {
        externalKey: "478.l.106344",
        yahooLeagueId: "106344",
        syncVia: "server",
        throttled: true,
      },
    });

    leagueFindFirst.mockResolvedValueOnce(stored({ syncedAt: secondsAgo({ seconds: 90 }) }));
    expect(await readStoredSync({ profileId: PROFILE_ID, leagueId: LEAGUE_ID })).toEqual({
      status: "ok",
      league: expect.objectContaining({ throttled: false }),
    });
    expect(leagueFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LEAGUE_ID, profileId: PROFILE_ID } }),
    );
  });
});

describe("syncLoadedLeague", () => {
  it("syncs with the requested mapping policy", async () => {
    const result = await syncLoadedLeague({
      profileId: PROFILE_ID,
      leagueId: LEAGUE_ID,
      loaded: loaded(),
      writeMappings: false,
      storedExternalKey: "478.l.106344",
    });

    expect(resolveYahooPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ writeMappings: false }),
    );
    expect(syncImportedLeague).toHaveBeenCalledWith(
      expect.objectContaining({ tx, profileId: PROFILE_ID, leagueId: LEAGUE_ID }),
    );
    expect(result).toEqual({
      status: "ok",
      syncedAt: "2026-10-17T12:00:00.000Z",
      unmatched: ["Waiver Guy"],
    });
  });

  it("records a changed Yahoo key without touching the league's data", async () => {
    const result = await syncLoadedLeague({
      profileId: PROFILE_ID,
      leagueId: LEAGUE_ID,
      loaded: loaded(),
      writeMappings: false,
      storedExternalKey: "466.l.106344",
    });

    expect(result).toEqual({ status: "error" });
    expect(leagueUpdate).toHaveBeenCalledWith({
      where: { id: LEAGUE_ID, profileId: PROFILE_ID },
      data: { syncError: "This league's Yahoo key changed; import it again." },
    });
    expect(resolveYahooPlayers).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });
});
