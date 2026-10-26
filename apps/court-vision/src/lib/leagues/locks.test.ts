import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "bun:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Profile } from "@generated/prisma/client";

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl !== undefined) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || !url.pathname.endsWith("_test")) {
    throw new Error("Integration tests require an isolated 127.0.0.1 database ending in _test");
  }
}
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: testUrl ?? "postgresql://127.0.0.1:1/unconfigured_test",
  }),
});
const profileId = randomUUID();
let staleProfile: Profile | null = null;
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth/session", () => ({
  getProfile: async () => staleProfile ?? db.profile.findUnique({ where: { id: profileId } }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

import { createLeague, deleteLeague } from "@/lib/leagues/actions";
import { importLegacyTeams } from "@/lib/leagues/teamActions";
import { starPlayer, unstarPlayer } from "@/lib/watchlist/actions";
import { claimSync, releaseSync } from "@/lib/yahoo/syncLease";
import { syncImportedLeague } from "@/lib/yahoo/persist";
import { allowUsernameAttempt, usernameRateKey } from "@/lib/auth/usernameRateLimit";
import { fetchRegularPool } from "@/lib/players/search";
import { fetchAdvancedPool } from "@/lib/players/searchAdvanced";
const { getFantasyPool } = await import("@/lib/valuation/loader");
import { aggregateSeasonStats } from "@/lib/balldontlie/transform";
import {
  findSeasonAggregateLogs,
  replaceGameLogsForGames,
  replaceAdvancedGameLogsForGames,
  upsertPlayers,
  upsertSeasonStats,
  withStatsTransaction,
} from "@/lib/stats/persist";
import { type AdvancedGameLogInput, type GameLogInput } from "@/lib/stats/inputs";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";
import leagueFixture from "@/lib/yahoo/fixtures/league-106344.json";
import { yahooLeagueSnapshotSchema } from "@/lib/yahoo/schemas";
import { toImportedLeague } from "@/lib/yahoo/transform";

const createOwnedLeague = async () =>
  db.league.create({
    data: {
      profileId,
      name: "Test",
      slug: randomUUID(),
      scoringConfig: { categories: ["pts"] },
    },
  });

type LegacyTeamProps = { name: string };
const legacyTeam = ({ name }: LegacyTeamProps): FantasyTeam => ({
  id: name,
  name,
  slug: "",
  slots: [{ id: "PG-1", type: "PG", player: null }],
  createdAt: new Date().toISOString(),
  logoUrl: null,
  managerName: null,
  isMine: false,
  isImported: false,
  unmatchedBySlotId: {},
});

describe.skipIf(testUrl === undefined)("Postgres mutation invariants", () => {
  beforeAll(async () => {
    await db.profile.create({
      data: {
        id: profileId,
        email: "integration@example.test",
        username: `test_${profileId.slice(0, 8)}`,
      },
    });
    await db.player.createMany({
      data: Array.from({ length: 51 }, (_, i) => ({
        id: 900_000 + i,
        firstName: "Test",
        lastName: String(i),
        fullName: `Test ${i}`,
      })),
    });
  });
  beforeEach(async () => {
    staleProfile = null;
    await db.league.deleteMany({ where: { profileId } });
    await db.requestRateLimit.deleteMany();
  });
  afterAll(async () => {
    await db.profile.delete({ where: { id: profileId } });
    await db.playerSeasonStats.deleteMany({ where: { playerId: 900_000 } });
    await db.playerGameLog.deleteMany({ where: { playerId: 900_000 } });
    await db.playerAdvancedGameLog.deleteMany({ where: { playerId: 900_000 } });
    await db.player.deleteMany({ where: { id: { gte: 900_000, lte: 900_050 } } });
    await db.requestRateLimit.deleteMany();
    await db.$disconnect();
  });

  it("allows only one of two differently named league creates at the cap", async () => {
    await Promise.all(Array.from({ length: 9 }, createOwnedLeague));
    const results = await Promise.all(
      ["One", "Two"].map((name) =>
        createLeague({
          name,
          scoringType: "roto",
          teamCount: 12,
          rosterSlots: 13,
          scoringConfig: { categories: ["pts"] },
        }),
      ),
    );
    expect(results.map(({ status }) => status).sort()).toEqual(["limit", "ok"]);
    expect(await db.league.count({ where: { profileId } })).toBe(10);
  });

  it("allows only one of two different stars at the watchlist cap", async () => {
    const league = await createOwnedLeague();
    await db.profile.update({ where: { id: profileId }, data: { activeLeagueId: league.id } });
    await db.leagueWatchlistPlayer.createMany({
      data: Array.from({ length: 49 }, (_, i) => ({
        leagueId: league.id,
        profileId,
        playerId: 900_000 + i,
      })),
    });
    const results = await Promise.all(
      [900_049, 900_050].map((playerId) => starPlayer({ playerId, leagueId: league.id })),
    );
    expect(results.map(({ status }) => status).sort()).toEqual(["limit", "ok"]);
    expect(await db.leagueWatchlistPlayer.count({ where: { leagueId: league.id } })).toBe(50);
  });

  it("refuses an old tab's star after the active league changes", async () => {
    const a = await createOwnedLeague();
    const b = await createOwnedLeague();
    staleProfile = await db.profile.update({
      where: { id: profileId },
      data: { activeLeagueId: a.id },
    });
    await db.profile.update({ where: { id: profileId }, data: { activeLeagueId: b.id } });
    expect(await starPlayer({ playerId: 900_000, leagueId: a.id })).toEqual({ status: "error" });
    expect(await db.leagueWatchlistPlayer.count({ where: { profileId } })).toBe(0);
    await db.leagueWatchlistPlayer.createMany({
      data: [a, b].map((league) => ({ leagueId: league.id, profileId, playerId: 900_000 })),
    });
    expect(await unstarPlayer({ playerId: 900_000, leagueId: a.id })).toEqual({ status: "error" });
    expect(await db.leagueWatchlistPlayer.count({ where: { profileId } })).toBe(2);
  });

  it("imports only one of two disjoint legacy batches", async () => {
    const league = await createOwnedLeague();
    await db.profile.update({ where: { id: profileId }, data: { activeLeagueId: league.id } });
    const results = await Promise.all(
      ["First", "Second"].map((name) => importLegacyTeams({ teams: [legacyTeam({ name })] })),
    );
    expect(results.map(({ status }) => status).sort()).toEqual(["ok", "skipped"]);
    expect(await db.leagueTeam.count({ where: { leagueId: league.id } })).toBe(1);
  });

  it("preserves a newer active choice despite a stale session snapshot", async () => {
    const a = await createOwnedLeague();
    const b = await createOwnedLeague();
    await createOwnedLeague();
    staleProfile = await db.profile.update({
      where: { id: profileId },
      data: { activeLeagueId: a.id },
    });
    await db.profile.update({ where: { id: profileId }, data: { activeLeagueId: b.id } });
    expect(await deleteLeague({ leagueId: a.id })).toEqual({ status: "ok", activeLeagueId: b.id });
    expect((await db.profile.findUniqueOrThrow({ where: { id: profileId } })).activeLeagueId).toBe(
      b.id,
    );
  });

  it("claims a sync exclusively and fences expired workers from writes and releases", async () => {
    const league = await createOwnedLeague();
    await db.league.update({
      where: { id: league.id },
      data: { provider: "yahoo", externalKey: "478.l.106344" },
    });
    const claims = await Promise.all(
      Array.from({ length: 4 }, () => claimSync({ profileId, leagueId: league.id })),
    );
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    const oldToken = new Date(Date.now() - 300_000);
    await db.league.update({
      where: { id: league.id },
      data: { syncStartedAt: oldToken, syncLeaseUntil: oldToken },
    });
    const token = await claimSync({ profileId, leagueId: league.id });
    expect(token).not.toBeNull();
    if (token === null) throw new Error("Claim failed");
    const imported = toImportedLeague({ snapshot: yahooLeagueSnapshotSchema.parse(leagueFixture) });
    if (imported.status !== "ok") throw new Error("Invalid fixture");
    await expect(
      db.$transaction((tx) =>
        syncImportedLeague({
          tx,
          profileId,
          leagueId: league.id,
          league: imported.league,
          resolved: { byYahooId: new Map(), unmatched: [] },
          waiverRefs: [],
          syncStartedAt: oldToken,
        }),
      ),
    ).rejects.toMatchObject({ code: "P2025" });
    await releaseSync({ profileId, leagueId: league.id, syncStartedAt: oldToken });
    const row = await db.league.findUniqueOrThrow({ where: { id: league.id } });
    expect(row.syncStartedAt).toEqual(token);
    expect(row.syncLeaseUntil).not.toBeNull();
    expect(await db.leagueTeam.count({ where: { leagueId: league.id } })).toBe(0);
    await releaseSync({ profileId, leagueId: league.id, syncStartedAt: token });
    expect(await claimSync({ profileId, leagueId: league.id })).toBeNull();
  });

  it("keeps all three last-N player tabs inside one regular season", async () => {
    const stats = {
      minutes: 30,
      fgm: 4,
      fga: 8,
      fg3m: 1,
      fg3a: 2,
      ftm: 1,
      fta: 2,
      oreb: 0,
      dreb: 2,
      reb: 2,
      ast: 2,
      stl: 1,
      blk: 0,
      tov: 1,
      pts: 10,
    };
    await db.playerSeasonStats.create({
      data: {
        ...stats,
        playerId: 900_000,
        gamesPlayed: 1,
        season: "2026-27",
        seasonType: "Regular Season",
      },
    });
    await Promise.all(
      ["2025-26", "2026-27"].map(async (season, index) => {
        const game = {
          playerId: 900_000,
          gameId: `season-${index}`,
          gameDate: new Date(`${2025 + index}-10-25`),
          season,
          seasonType: "Regular Season",
          teamId: 1,
          teamAbbr: "BOS",
        };
        await db.playerGameLog.create({
          data: {
            ...stats,
            ...game,
            pts: index === 0 ? 50 : 10,
            matchup: "BOS vs NYK",
            homeAway: "Home",
          },
        });
        await db.playerAdvancedGameLog.create({ data: { ...game, pie: index === 0 ? 100 : 2 } });
      }),
    );
    const regular = await fetchRegularPool({ range: "last5" });
    const advanced = await fetchAdvancedPool({ range: "last5" });
    const fantasy = await getFantasyPool({ range: "last5" });
    expect(regular[0]?.stats.pts).toBe(10);
    expect(regular[0]?.stats.gamesPlayed).toBe(1);
    expect(advanced[0]?.stats.pie).toBe(2);
    expect(advanced[0]?.stats.gamesWithData).toBe(1);
    expect(fantasy[0]?.stats.pts).toBe(10);
    expect(fantasy[0]?.gamesPlayed).toBe(1);
  });

  it("rolls back every stats surface when the final advanced write fails", async () => {
    const game = {
      playerId: 900_000,
      gameId: "atomic-sync",
      gameDate: new Date("2026-10-26"),
      season: "2026-27",
      seasonType: "Regular Season",
      teamId: 1,
      teamAbbr: "BOS",
    };
    const log: GameLogInput = {
      ...game,
      minutes: 30,
      fgm: 4,
      fga: 8,
      fg3m: 1,
      fg3a: 2,
      ftm: 1,
      fta: 2,
      oreb: 0,
      dreb: 2,
      reb: 2,
      ast: 2,
      stl: 1,
      blk: 0,
      tov: 1,
      pts: 10,
      matchup: "BOS vs NYK",
      homeAway: "home",
      opponentAbbr: "NYK",
      winLoss: "W",
      teamScore: 100,
      opponentScore: 90,
      plusMinus: 1,
    };
    await db.playerGameLog.deleteMany({ where: { playerId: game.playerId } });
    await db.playerSeasonStats.deleteMany({ where: { playerId: game.playerId } });
    await db.playerAdvancedGameLog.deleteMany({ where: { playerId: game.playerId } });
    await db.playerGameLog.create({ data: log });
    await db.playerSeasonStats.createMany({ data: aggregateSeasonStats({ logs: [log] }) });
    const advanced = await db.playerAdvancedGameLog.create({ data: { ...game, pie: 1 } });
    const { id: _id, ...advancedInput } = advanced;

    const write = (rows: AdvancedGameLogInput[]) =>
      withStatsTransaction(async (tx) => {
        await upsertPlayers({
          tx,
          players: [
            {
              id: game.playerId,
              firstName: "Changed",
              lastName: "0",
              fullName: "Changed 0",
              teamId: 1,
              teamAbbr: "BOS",
              position: null,
              jerseyNumber: null,
            },
          ],
        });
        await replaceGameLogsForGames({ tx, rows: [{ ...log, pts: 30 }] });
        const logs = await findSeasonAggregateLogs({
          tx,
          playerIds: [game.playerId],
          seasons: [game.season],
          seasonType: game.seasonType,
        });
        await upsertSeasonStats({ tx, rows: aggregateSeasonStats({ logs }) });
        await replaceAdvancedGameLogsForGames({ tx, rows });
      });
    const updatedAdvanced = { ...advancedInput, pie: 2 };
    // Duplicate input fails the last insert after every earlier surface was written.
    await expect(write([updatedAdvanced, updatedAdvanced])).rejects.toMatchObject({
      code: "P2002",
    });
    expect((await db.player.findUniqueOrThrow({ where: { id: game.playerId } })).firstName).toBe(
      "Test",
    );
    expect((await db.playerGameLog.findFirstOrThrow({ where: { gameId: game.gameId } })).pts).toBe(
      10,
    );
    expect(
      (await db.playerSeasonStats.findFirstOrThrow({ where: { playerId: game.playerId } })).pts,
    ).toBe(10);
    expect(
      (await db.playerAdvancedGameLog.findFirstOrThrow({ where: { gameId: game.gameId } })).pie,
    ).toBe(1);

    await write([updatedAdvanced]);
    expect((await db.playerGameLog.findFirstOrThrow({ where: { gameId: game.gameId } })).pts).toBe(
      30,
    );
    expect(
      (await db.playerSeasonStats.findFirstOrThrow({ where: { playerId: game.playerId } })).pts,
    ).toBe(30);
    expect(
      (await db.playerAdvancedGameLog.findFirstOrThrow({ where: { gameId: game.gameId } })).pie,
    ).toBe(2);
  });

  it("shares one atomic username budget across concurrent requests", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, allowUsernameAttempt));
    expect(results.filter(Boolean)).toHaveLength(30);
    expect(
      (
        await db.requestRateLimit.findUniqueOrThrow({
          where: { key: usernameRateKey({ netlify: false, clientIp: null }) },
        })
      ).attempts,
    ).toBe(30);
    await db.requestRateLimit.update({
      where: { key: "username:global" },
      data: { attempts: 1000 },
    });
    expect(await allowUsernameAttempt()).toBe(false);
    await db.requestRateLimit.updateMany({ data: { expiresAt: new Date(0) } });
    expect(await allowUsernameAttempt()).toBe(true);
  });
});
