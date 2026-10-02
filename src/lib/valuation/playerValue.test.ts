import { describe, expect, it } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import {
  buildPlayerFantasyProfile,
  configFromSeed,
  type FantasyProfileLog,
} from "@/lib/valuation/playerValue";
import { FANTASY_METHODS } from "@/lib/valuation/registry";

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

const { config, methodWeights } = configFromSeed({ seed: {} });

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
  gameId,
  gameDate: new Date(Date.UTC(2025, 9, day)),
  matchup: `LAL vs. OPP${day}`,
  winLoss: "W",
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
});

const logs = Array.from({ length: 15 }, (_, index) =>
  log({ gameId: `g${index + 1}`, day: index + 1 }),
);

describe("configFromSeed", () => {
  it("falls back to the Fantasy tab defaults with an empty seed", () => {
    expect(config.teams).toBe(12);
    expect(config.rosterSlots).toBe(13);
    expect(config.basis).toBe("perGame");
    expect(config.categories).toEqual([
      "pts",
      "reb",
      "ast",
      "stl",
      "blk",
      "tpm",
      "tov",
      "fg",
      "ft",
    ]);
    expect(config.scoring).toEqual(DEFAULT_POINTS_SCORING);
    expect(methodWeights).toEqual({});
  });

  it("applies the active league's size, exclusions, weights, and scoring", () => {
    const seeded = configFromSeed({
      seed: {
        teams: 10,
        slots: 15,
        x: ["ft", "tov"],
        w: { z: { pts: 0.5 } },
        s: { ...DEFAULT_POINTS_SCORING, reb: 2 },
      },
    });

    expect(seeded.config.teams).toBe(10);
    expect(seeded.config.rosterSlots).toBe(15);
    expect(seeded.config.categories).toEqual(["pts", "reb", "ast", "stl", "blk", "tpm", "fg"]);
    expect(seeded.config.scoring.reb).toBe(2);
    expect(seeded.methodWeights).toEqual({ z: { pts: 0.5 } });
  });
});

describe("buildPlayerFantasyProfile", () => {
  const profile = buildPlayerFantasyProfile({
    lines,
    playerId: 7,
    config,
    methodWeights,
    range: "all",
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
        range: "all",
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
      range: "all",
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
      range: "last5",
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

  it("flags DNPs in the trend", () => {
    const withDnp = buildPlayerFantasyProfile({
      lines,
      playerId: 7,
      config,
      methodWeights,
      range: "all",
      logs: [...logs, log({ gameId: "dnp", day: 16, minutes: 0, pts: 0 })],
      windowGames: null,
    });

    expect(withDnp?.trend[15]?.dnp).toBe(true);
  });

  it("reports the standardizing pool size", () => {
    expect(profile?.poolSize).toBeGreaterThan(0);
  });
});
