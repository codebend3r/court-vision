import { beforeEach, describe, expect, it, vi } from "bun:test";

import { type League } from "@generated/prisma/client";
import { type LeagueSyncVia } from "@/lib/leagues/types";
import { type ResolvedPlayers } from "@/lib/yahoo/matchPlayers";
import * as realSchemas from "@/lib/yahoo/schemas";
import { type YahooPlayerRef } from "@/lib/yahoo/types";

type ResolveArgs = { refs: readonly YahooPlayerRef[]; writeMappings: boolean };
type CreateArgs = { myTeamExternalKey: string; syncVia: LeagueSyncVia };

const claimSync = vi.fn<() => Promise<Date | null>>(async () => new Date("2026-10-26T00:00:00Z"));
const releaseSync = vi.fn(async () => {});
vi.mock("@/lib/yahoo/syncLease", () => ({ claimSync, releaseSync }));
const getProfile = vi.fn();
const resolveYahooPlayers = vi.fn<(args: ResolveArgs) => Promise<ResolvedPlayers>>();
const createImportedLeague = vi.fn<(args: CreateArgs) => Promise<League>>();
type SyncImportedLeagueProps = { leagueId: string };

const syncImportedLeague = vi.fn<(args: SyncImportedLeagueProps) => Promise<League>>();

const leagueFindFirst = vi.fn();
const leagueUpdate = vi.fn();
const leagueCount = vi.fn<() => Promise<number>>();
const $transaction = vi.fn();
const txFindFirst = vi.fn();
const txCount = vi.fn<() => Promise<number>>();

const lockProfile = vi.fn(async () => ({ activeLeagueId: null }));
vi.mock("@/lib/leagues/locks", () => ({ lockProfile }));
const tx = { league: { findFirst: txFindFirst, count: txCount } };

// The real schemas, with the game body's parse watched so a test can tell
// whether the size cap answered before any zod parse ran.
const schemas = { ...realSchemas };
const gameSafeParse = vi.fn((body: unknown) => schemas.yahooGameSchema.safeParse(body));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: {
      findFirst: leagueFindFirst,
      update: leagueUpdate,
      updateMany: leagueUpdate,
      count: leagueCount,
    },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => {
      $transaction();
      return fn(tx);
    }),
  },
}));
vi.mock("@/lib/auth/session", () => ({ getProfile }));
vi.mock("@/lib/yahoo/matchPlayers", () => ({ resolveYahooPlayers }));
vi.mock("@/lib/yahoo/persist", () => ({ createImportedLeague, syncImportedLeague }));
vi.mock("@/lib/yahoo/schemas", () => ({
  ...schemas,
  yahooGameSchema: { safeParse: gameSafeParse },
}));

import gameNba from "@/lib/yahoo/fixtures/game-nba.json";
import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import waivers106344 from "@/lib/yahoo/fixtures/waivers-106344.json";
import {
  snapshotWithRosterSize,
  snapshotWithTeamCount,
  waiverPageWithPlayers,
} from "@/lib/yahoo/fixtures/oversized";
import { KEY_CHANGED_MESSAGE } from "@/lib/yahoo/messages";
import {
  importYahooLeagueFromSnapshot,
  previewYahooSnapshot,
  syncYahooLeagueFromSnapshot,
} from "@/lib/yahoo/snapshotActions";

const PROFILE_ID = "prof-1";
const LEAGUE_ID = "league-1";
const NEWFOUNDLANDERS = "478.l.106344.t.5";

const profile = { id: PROFILE_ID, activeLeagueId: null };

// What the extension hands over for Game of Courts: the game body, the league
// snapshot and one waiver page, exactly as Yahoo answered them.
const payload = {
  game: gameNba,
  snapshot: league106344,
  waiverPages: [waivers106344],
};

const NEXT_SEASON_GAME = { fantasy_content: { game: { game_key: "479", season: "2027" } } };

const resolved: ResolvedPlayers = { byYahooId: new Map(), unmatched: [] };

type LeagueRowProps = { syncVia: LeagueSyncVia };

const leagueRow = ({ syncVia }: LeagueRowProps): League => ({
  id: LEAGUE_ID,
  profileId: PROFILE_ID,
  name: "Game of Courts",
  slug: "game-of-courts",
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts", "reb", "ast"] },
  provider: "yahoo",
  syncVia,
  externalKey: "478.l.106344",
  externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
  myTeamId: "team-5",
  syncedAt: new Date("2026-10-17T12:00:00Z"),
  syncStartedAt: null,
  syncLeaseUntil: null,
  syncError: null,
  unsupportedCategories: [],
  statCategories: null,
  createdAt: new Date("2026-10-17T12:00:00Z"),
  updatedAt: new Date("2026-10-17T12:00:00Z"),
});

type SecondsAgoProps = { seconds: number };

const secondsAgo = ({ seconds }: SecondsAgoProps): Date => new Date(Date.now() - seconds * 1000);

// The row `readStoredSync` reads: a Yahoo import last synced 5 minutes ago.
type StoredLeagueProps = {
  syncVia?: string;
  syncedAt?: Date;
  externalKey?: string;
};

const storedLeague = ({
  syncVia = "extension",
  syncedAt = secondsAgo({ seconds: 300 }),
  externalKey = "478.l.106344",
}: StoredLeagueProps = {}) => ({
  provider: "yahoo",
  syncVia,
  externalKey,
  syncedAt,
  syncError: null,
  updatedAt: syncedAt,
});

const expectNoWrites = () => {
  expect(resolveYahooPlayers).not.toHaveBeenCalled();
  expect(createImportedLeague).not.toHaveBeenCalled();
  expect(syncImportedLeague).not.toHaveBeenCalled();
  expect(leagueUpdate).not.toHaveBeenCalled();
  expect($transaction).not.toHaveBeenCalled();
};

const expectNoPrisma = () => {
  expect(leagueFindFirst).not.toHaveBeenCalled();
  expect(leagueCount).not.toHaveBeenCalled();
  expectNoWrites();
};

beforeEach(() => {
  [
    getProfile,
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
  gameSafeParse.mockClear();

  getProfile.mockResolvedValue(profile);
  resolveYahooPlayers.mockResolvedValue(resolved);
  createImportedLeague.mockResolvedValue(leagueRow({ syncVia: "extension" }));
  syncImportedLeague.mockResolvedValue(leagueRow({ syncVia: "server" }));
  leagueFindFirst.mockResolvedValue(null);
  leagueCount.mockResolvedValue(0);
  leagueUpdate.mockResolvedValue(leagueRow({ syncVia: "server" }));
  txFindFirst.mockResolvedValue(null);
  txCount.mockResolvedValue(0);
});

describe("every snapshot action", () => {
  it("answers unauthenticated without a profile", async () => {
    getProfile.mockResolvedValue(null);

    expect(await previewYahooSnapshot({ payload })).toEqual({ status: "unauthenticated" });
    expect(
      await importYahooLeagueFromSnapshot({ payload, myTeamExternalKey: NEWFOUNDLANDERS }),
    ).toEqual({ status: "unauthenticated" });
    expect(await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload })).toEqual({
      status: "unauthenticated",
    });
    expectNoPrisma();
  });

  it("refuses a payload that isn't a bridge payload", async () => {
    const forged: unknown[] = [null, {}, { game: {}, snapshot: {}, waiverPages: "x" }];

    const previews = await Promise.all(forged.map((bad) => previewYahooSnapshot({ payload: bad })));
    const imports = await Promise.all(
      forged.map((bad) =>
        importYahooLeagueFromSnapshot({ payload: bad, myTeamExternalKey: NEWFOUNDLANDERS }),
      ),
    );

    expect([...previews, ...imports]).toEqual(
      Array.from({ length: 6 }, () => ({ status: "invalid_payload" })),
    );
    expectNoPrisma();
  });

  it("refuses a sync payload that isn't a bridge payload without writing", async () => {
    leagueFindFirst.mockResolvedValue(storedLeague());

    expect(await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload: null })).toEqual({
      status: "invalid_payload",
    });
    expectNoWrites();
  });

  it("refuses a payload over 1.5 MB", async () => {
    // A well-formed page padded past the cap: zod would strip the extra key
    // and import it, so only the size check can refuse it.
    const padded = { ...waivers106344, padding: "x".repeat(1_600_000) };
    const oversized = { ...payload, waiverPages: [padded] };
    // Parsed, next season's game would answer past_season; the cap answers first.
    const oversizedNextSeason = { ...oversized, game: NEXT_SEASON_GAME };

    expect(await previewYahooSnapshot({ payload: oversizedNextSeason })).toEqual({
      status: "invalid_payload",
    });
    expect(
      await importYahooLeagueFromSnapshot({
        payload: oversized,
        myTeamExternalKey: NEWFOUNDLANDERS,
      }),
    ).toEqual({ status: "invalid_payload" });
    expectNoPrisma();

    leagueFindFirst.mockResolvedValueOnce(storedLeague());
    expect(
      await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload: oversizedNextSeason }),
    ).toEqual({ status: "invalid_payload" });
    expectNoWrites();
    expect(gameSafeParse).not.toHaveBeenCalled();
  });

  it("refuses a snapshot carrying more teams, roster players or waiver pages than Yahoo allows", async () => {
    // Each is under 1.5 MB and otherwise well formed, so only the count caps
    // stand between it and an import that grows much faster than its size.
    const overCounts = [
      { ...payload, snapshot: snapshotWithTeamCount({ count: 33 }) },
      { ...payload, snapshot: snapshotWithRosterSize({ count: 65 }) },
      { ...payload, waiverPages: Array.from({ length: 11 }, () => waivers106344) },
      { ...payload, waiverPages: [waivers106344, waiverPageWithPlayers({ count: 26 })] },
    ];

    const previews = await Promise.all(
      overCounts.map((forged) => previewYahooSnapshot({ payload: forged })),
    );
    const imports = await Promise.all(
      overCounts.map((forged) =>
        importYahooLeagueFromSnapshot({ payload: forged, myTeamExternalKey: NEWFOUNDLANDERS }),
      ),
    );

    expect([...previews, ...imports]).toEqual(
      Array.from({ length: 8 }, () => ({ status: "invalid_payload" })),
    );
    expectNoPrisma();

    leagueFindFirst.mockResolvedValue(storedLeague());
    const syncs = await Promise.all(
      overCounts.map((forged) =>
        syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload: forged }),
      ),
    );

    expect(syncs).toEqual(Array.from({ length: 4 }, () => ({ status: "invalid_payload" })));
    expectNoWrites();
    expect(gameSafeParse).not.toHaveBeenCalled();
  });

  it("rejects roster layouts before expanding forged counts", async () => {
    const layouts = [
      [{ roster_position: { position: "PG", count: 1_000_000_000 } }],
      [{ roster_position: { position: "PG", count: -1 } }],
      [{ roster_position: { position: "PG", count: 1.5 } }],
      [
        { roster_position: { position: "PG", count: 40 } },
        { roster_position: { position: "C", count: 40 } },
      ],
      Array.from({ length: 65 }, () => ({ roster_position: { position: "PG", count: 0 } })),
    ];
    await Promise.all(
      layouts.map(async (roster_positions) => {
        const original = league106344.fantasy_content.league;
        const snapshot = {
          fantasy_content: {
            league: { ...original, settings: { ...original.settings, roster_positions } },
          },
        };
        expect(await previewYahooSnapshot({ payload: { ...payload, snapshot } })).toEqual({
          status: "invalid_payload",
        });
        expect(
          await importYahooLeagueFromSnapshot({
            payload: { ...payload, snapshot },
            myTeamExternalKey: NEWFOUNDLANDERS,
          }),
        ).toEqual({ status: "invalid_payload" });
      }),
    );
    expectNoPrisma();
  });

  it("refuses a few hundred bytes that decode into a deep shared chain", async () => {
    // React's reply decoder reuses one outlined chunk wherever the body names
    // it, so each level here doubles what JSON would write.
    type Chain = { a: unknown; b: unknown };
    const chain = Array.from({ length: 30 }).reduce<unknown>(
      (inner): Chain => ({ a: inner, b: inner }),
      "leaf",
    );
    expect(await previewYahooSnapshot({ payload: { ...payload, snapshot: chain } })).toEqual({
      status: "invalid_payload",
    });
    expect(gameSafeParse).not.toHaveBeenCalled();
  });

  it("refuses a game body that doesn't parse", async () => {
    const badGame = { ...payload, game: { fantasy_content: {} } };
    leagueFindFirst.mockResolvedValueOnce(storedLeague());

    expect(await previewYahooSnapshot({ payload: badGame })).toEqual({
      status: "invalid_payload",
    });
    expect(await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload: badGame })).toEqual({
      status: "invalid_payload",
    });
    expectNoWrites();
  });

  it("refuses a league from another season", async () => {
    const nextSeason = { ...payload, game: NEXT_SEASON_GAME };

    expect(await previewYahooSnapshot({ payload: nextSeason })).toEqual({
      status: "past_season",
    });
    expect(
      await importYahooLeagueFromSnapshot({
        payload: nextSeason,
        myTeamExternalKey: NEWFOUNDLANDERS,
      }),
    ).toEqual({ status: "past_season" });
    leagueFindFirst.mockResolvedValueOnce(storedLeague());
    expect(await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload: nextSeason })).toEqual(
      { status: "past_season" },
    );
    expectNoWrites();
  });
});

describe("previewYahooSnapshot", () => {
  it("previews from the Game of Courts fixture", async () => {
    const result = await previewYahooSnapshot({ payload });

    if (result.status !== "ok") throw new Error(`expected ok, got ${result.status}`);
    expect(result.preview.name).toBe("Game of Courts");
    expect(result.preview.teams).toHaveLength(12);
    expect(gameSafeParse).toHaveBeenCalledWith(gameNba);
    expectNoPrisma();
  });
});

describe("importYahooLeagueFromSnapshot", () => {
  it("imports through the extension without writing shared mappings", async () => {
    const result = await importYahooLeagueFromSnapshot({
      payload,
      myTeamExternalKey: NEWFOUNDLANDERS,
    });

    expect(resolveYahooPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ writeMappings: false }),
    );
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
      unmatched: [],
    });
  });

  it("refuses a team key that isn't in the snapshot", async () => {
    expect(
      await importYahooLeagueFromSnapshot({ payload, myTeamExternalKey: "478.l.999.t.1" }),
    ).toEqual({ status: "invalid_team" });
    // @ts-expect-error Simulate an object arriving from a forged request body.
    expect(await importYahooLeagueFromSnapshot({ payload, myTeamExternalKey: {} })).toEqual({
      status: "invalid_team",
    });
    expectNoWrites();
  });
});

describe("syncYahooLeagueFromSnapshot", () => {
  it("does not persist when another worker owns the sync", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague());
    claimSync.mockResolvedValueOnce(null);
    expect(await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload })).toEqual({
      status: "throttled",
    });
    expect(syncImportedLeague).not.toHaveBeenCalled();
  });
  it("syncs only a league the caller owns", async () => {
    expect(await syncYahooLeagueFromSnapshot({ leagueId: "forged", payload })).toEqual({
      status: "error",
    });
    expect(leagueFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "forged", profileId: PROFILE_ID } }),
    );
    expectNoWrites();

    leagueFindFirst.mockClear();
    getProfile.mockClear();
    // @ts-expect-error Simulate an object arriving from a forged request body.
    expect(await syncYahooLeagueFromSnapshot({ leagueId: {}, payload })).toEqual({
      status: "error",
    });
    expect(getProfile).not.toHaveBeenCalled();
    expectNoPrisma();
  });

  it("refuses a manual league and throttles a recent sync", async () => {
    leagueFindFirst.mockResolvedValueOnce({
      ...storedLeague(),
      provider: "manual",
      externalKey: null,
    });
    expect(await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload })).toEqual({
      status: "not_imported",
    });

    leagueFindFirst.mockResolvedValueOnce(storedLeague({ syncedAt: secondsAgo({ seconds: 30 }) }));
    expect(await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload })).toEqual({
      status: "throttled",
    });
    expectNoWrites();
  });

  it("syncs an extension league without writing shared mappings", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague());

    const result = await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload });

    expect(resolveYahooPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ writeMappings: false }),
    );
    expect(syncImportedLeague).toHaveBeenCalledWith(
      expect.objectContaining({ tx, profileId: PROFILE_ID, leagueId: LEAGUE_ID }),
    );
    expect(result).toEqual({
      status: "ok",
      syncedAt: "2026-10-17T12:00:00.000Z",
      unmatched: [],
    });
  });

  it("records a snapshot whose Yahoo key differs from the stored one", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague({ externalKey: "466.l.106344" }));

    const result = await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload });

    expect(result).toEqual({ status: "error" });
    expect(leagueUpdate).toHaveBeenCalledWith({
      where: {
        id: LEAGUE_ID,
        profileId: PROFILE_ID,
        syncStartedAt: new Date("2026-10-26T00:00:00Z"),
      },
      data: { syncError: KEY_CHANGED_MESSAGE },
    });
    expect(resolveYahooPlayers).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it("syncs a server league from a snapshot too", async () => {
    leagueFindFirst.mockResolvedValueOnce(storedLeague({ syncVia: "server" }));

    const result = await syncYahooLeagueFromSnapshot({ leagueId: LEAGUE_ID, payload });

    expect(result).toEqual(expect.objectContaining({ status: "ok" }));
    expect(resolveYahooPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ writeMappings: false }),
    );
    // The sync never touches `syncVia`: no update of its own, and nothing
    // handed to the guarded sync write names it.
    expect(leagueUpdate).not.toHaveBeenCalled();
    expect(syncImportedLeague.mock.calls[0]?.[0]).not.toHaveProperty("syncVia");
  });
});
