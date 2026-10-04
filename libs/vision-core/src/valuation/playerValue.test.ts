import { describe, expect, it, vi } from "bun:test";

import {
  buildPlayerFantasyProfile,
  DEFAULT_VALUATION_CONFIG,
  FANTASY_METHODS,
  type FantasyProfileLog,
  makeDatedLog,
  makeStatLine,
  type MethodWeights,
} from "#core/testing/basketball";
import * as trendModule from "#core/valuation/trend";

// A pool spread out in every category so each sigma is honestly non-zero.
const poolLine = (index: number) =>
  makeStatLine({
    playerId: index + 100,
    pts: 300 + index * 30,
    reb: 150 + index * 10,
    ast: 100 + index * 8,
    stl: 30 + index * 3,
    blk: 15 + index * 2,
    fg3m: 40 + index * 5,
    tov: 60 + index * 4,
    fgm: 150 + index * 12,
    fga: 350 + index * 20,
    ftm: 80 + index * 6,
    fta: 100 + index * 7,
  });

// Head and shoulders above the pool in every counting category (and a free
// throw rate the pool's tight spread rewards), with a heavy turnover line.
const star = makeStatLine({
  playerId: 7,
  fullName: "Luka Doncic",
  firstName: "Luka",
  lastName: "Doncic",
  position: "F-G",
  pts: 1500,
  reb: 450,
  ast: 450,
  stl: 80,
  blk: 30,
  fg3m: 200,
  tov: 200,
  fgm: 500,
  fga: 1000,
  ftm: 440,
  fta: 500,
});

const lines = [star, ...Array.from({ length: 20 }, (_, index) => poolLine(index))];

const config = DEFAULT_VALUATION_CONFIG;
const methodWeights: MethodWeights = {};

const log = ({
  gameId,
  day,
  pts = 30,
  minutes = 34,
}: {
  gameId: string;
  day: number;
  pts?: number;
  minutes?: number;
}): FantasyProfileLog => ({
  ...makeDatedLog({
    gameDate: new Date(Date.UTC(2025, 9, day)),
    minutes,
    pts,
    reb: 9,
    ast: 9,
    stl: 1.5,
    blk: 0.5,
    fg3m: 4,
    tov: 4,
    fgm: 10,
    fga: 20,
    ftm: 8,
    fta: 10,
  }),
  gameId,
  matchup: `LAL vs. OPP${day}`,
  winLoss: "W",
});

const logs = Array.from({ length: 15 }, (_, index) =>
  log({ gameId: `g${index + 1}`, day: index + 1 }),
);

describe("buildPlayerFantasyProfile", () => {
  const profile = buildPlayerFantasyProfile({
    lines,
    playerId: 7,
    config,
    methodWeights,
    poolWindowGames: null,
    logs,
    windowGames: null,
  });

  it("returns null when the player has no line in the pool", () => {
    expect(
      buildPlayerFantasyProfile({
        lines,
        playerId: 999,
        config,
        methodWeights,
        poolWindowGames: null,
        logs,
        windowGames: null,
      }),
    ).toBeNull();
  });

  it("reads out every registry method in order, ranked against every valued player", () => {
    expect(profile?.readouts.map((readout) => readout.key)).toEqual(
      FANTASY_METHODS.map((method) => method.key),
    );
    const z = profile?.readouts.find((readout) => readout.key === "zscore");
    expect(z?.label).toBe("Z-Score");
    expect(z?.value).toBeGreaterThan(0);
    expect(z?.rank).toBe(1);
    expect(z?.of).toBe(lines.length);
  });

  it("breaks the value down per included category with the player's per-game line", () => {
    const pts = profile?.breakdown.find((entry) => entry.key === "pts");
    expect(profile?.breakdown).toHaveLength(9);
    expect(pts?.label).toBe("PTS");
    expect(pts?.perGame).toBe(30);
    expect(pts?.z).toBeGreaterThan(0);
    expect(pts?.g).toBeGreaterThan(0);
    // Turnovers are sign-corrected: a heavy turnover line reads negative.
    expect(profile?.breakdown.find((entry) => entry.key === "tov")?.z).toBeLessThan(0);
    // Ratio categories display as a make rate.
    expect(profile?.breakdown.find((entry) => entry.key === "fg")?.perGame).toBe(0.5);
  });

  it("omits excluded categories from the breakdown", () => {
    const excluded = buildPlayerFantasyProfile({
      lines,
      playerId: 7,
      config: { ...config, categories: ["pts", "reb"] },
      methodWeights,
      poolWindowGames: null,
      logs,
      windowGames: null,
    });

    expect(excluded?.breakdown.map((entry) => entry.key)).toEqual(["pts", "reb"]);
  });

  it("plots one trend point per game, empty until the rolling window fills", () => {
    expect(profile?.trend).toHaveLength(15);
    expect(profile?.trend[0]).toMatchObject({
      gameIndex: 1,
      gameDate: "2025-10-01T00:00:00.000Z",
      matchup: "LAL vs. OPP1",
      dnp: false,
      z: null,
      g: null,
    });
    expect(profile?.trend[8]?.z).toBeNull();
    expect(typeof profile?.trend[9]?.z).toBe("number");
    expect(typeof profile?.trend[14]?.g).toBe("number");
  });

  it("windows the trend to the last N games and renumbers them", () => {
    const windowed = buildPlayerFantasyProfile({
      lines,
      playerId: 7,
      config,
      methodWeights,
      poolWindowGames: 5,
      logs,
      windowGames: 5,
    });

    expect(windowed?.trend.map((point) => point.gameIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(windowed?.trend[0]?.matchup).toBe("LAL vs. OPP11");
    // Each windowed game still looks back over the ten before it.
    expect(typeof windowed?.trend[0]?.z).toBe("number");
  });

  it("values every game in the season for the game log, aligned with the logs", () => {
    expect(profile?.games).toHaveLength(15);
    expect(typeof profile?.games[0]?.z).toBe("number");
    expect(profile?.games[8]?.rollingZ).toBeNull();
    expect(typeof profile?.games[14]?.rollingG).toBe("number");
  });

  it("computes one rolling timeline shared by the windowed chart and full game log", () => {
    const buildTrend = vi.spyOn(trendModule, "buildFantasyTrend");
    try {
      const shared = buildPlayerFantasyProfile({
        lines,
        playerId: 7,
        config,
        methodWeights,
        poolWindowGames: 5,
        logs: [...logs, log({ gameId: "dnp", day: 16, minutes: 0, pts: 0 })],
        windowGames: 5,
      });

      if (shared === null) throw new Error("missing fantasy profile");
      expect(buildTrend).toHaveBeenCalledTimes(1);
      expect(buildTrend).toHaveBeenCalledWith(expect.objectContaining({ windowGames: null }));
      expect(shared.games).toHaveLength(16);
      expect(
        shared.trend.map(({ gameIndex, gameNumber, z, g }) => ({ gameIndex, gameNumber, z, g })),
      ).toEqual(
        shared.games.slice(-5).map((game, index) => ({
          gameIndex: index + 1,
          gameNumber: index + 12,
          z: game.rollingZ,
          g: game.rollingG,
        })),
      );
      expect(shared.trend.at(-1)?.matchup ?? "").toBe("LAL vs. OPP16");
      expect(shared.trend.at(-1)?.dnp ?? false).toBe(true);
    } finally {
      buildTrend.mockRestore();
    }
  });

  it("flags DNPs in the trend", () => {
    const withDnp = buildPlayerFantasyProfile({
      lines,
      playerId: 7,
      config,
      methodWeights,
      poolWindowGames: null,
      logs: [...logs, log({ gameId: "dnp", day: 16, minutes: 0, pts: 0 })],
      windowGames: null,
    });

    expect(withDnp?.trend[15]?.dnp).toBe(true);
  });

  it("reports the standardizing pool size", () => {
    expect(profile?.poolSize).toBeGreaterThan(0);
  });
});
