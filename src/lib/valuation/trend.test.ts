import { describe, expect, it } from "bun:test";

import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { computePoolStats } from "@/lib/valuation/pool";
import { buildFantasyTrend } from "@/lib/valuation/trend";
import { type ValuationConfig } from "@/lib/valuation/types";
import { ROLLING_WINDOW_GAMES, type DatedLog } from "@/lib/watchlist/trend";

const log = ({
  day,
  pts = 30,
  minutes = 34,
}: {
  day: number;
  pts?: number;
  minutes?: number;
}): DatedLog => ({
  gameDate: new Date(Date.UTC(2026, 0, day)),
  minutes,
  pts,
  reb: 5,
  ast: 5,
  stl: 1,
  blk: 1,
  fg3m: 2,
  tov: 2,
  fgm: 10,
  fga: 20,
  ftm: 6,
  fta: 7,
});

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

const star = makeStatLine({ playerId: 7, fullName: "Luka Doncic", pts: 1500 });
const lines = [star, ...Array.from({ length: 20 }, (_, index) => poolLine(index))];
const poolStats = computePoolStats({ lines, basis: "perGame", poolSize: 150, range: "all" });
const config: ValuationConfig = {
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: DEFAULT_POINTS_SCORING,
};

const build = ({ logs, windowGames = null }: { logs: DatedLog[]; windowGames?: number | null }) =>
  buildFantasyTrend({ line: star, logs, poolStats, config, methodWeights: {}, windowGames });

describe("buildFantasyTrend", () => {
  it("leaves the games before the window fills null and scores every game after", () => {
    const trend = build({
      logs: Array.from({ length: 12 }, (_, index) => log({ day: index + 1 })),
    });

    expect(trend).toHaveLength(12);
    const lead = trend.slice(0, ROLLING_WINDOW_GAMES - 1);
    expect(lead.every((point) => point.z === null && point.g === null)).toBe(true);
    expect(typeof trend[ROLLING_WINDOW_GAMES - 1]?.z).toBe("number");
    expect(typeof trend[11]?.g).toBe("number");
    expect(trend[0]?.gameIndex).toBe(1);
    expect(trend[0]?.gameDate).toBe("2026-01-01T00:00:00.000Z");
  });

  it("windows to the last N games while each still looks back over the ten before it", () => {
    const trend = build({
      logs: Array.from({ length: 15 }, (_, index) => log({ day: index + 1 })),
      windowGames: 5,
    });

    expect(trend.map((point) => point.gameIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(trend.every((point) => point.z !== null && point.g !== null)).toBe(true);
    expect(trend[0]?.gameDate).toBe("2026-01-11T00:00:00.000Z");
  });

  it("numbers each point by its game in the season, however the window is cut", () => {
    const logs = Array.from({ length: 15 }, (_, index) => log({ day: index + 1 }));

    expect(build({ logs }).map((point) => point.gameNumber)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
    const windowed = build({ logs, windowGames: 5 });
    expect(windowed.map((point) => point.gameNumber)).toEqual([11, 12, 13, 14, 15]);
    // The position within the window stays 1-based for the player page's axis.
    expect(windowed.map((point) => point.gameIndex)).toEqual([1, 2, 3, 4, 5]);
  });

  it("flags zero-minute games as missed", () => {
    const trend = build({
      logs: [log({ day: 1 }), log({ day: 2 }), log({ day: 3, minutes: 0 })],
    });

    expect(trend.map((point) => point.dnp)).toEqual([false, false, true]);
  });

  it("rises when the recent window outscores the earlier one", () => {
    const logs = Array.from({ length: 20 }, (_, index) =>
      log({ day: index + 1, pts: index < 10 ? 10 : 40 }),
    );
    const trend = build({ logs });

    const early = trend[ROLLING_WINDOW_GAMES - 1]?.z ?? 0;
    const late = trend[19]?.z ?? 0;
    expect(late).toBeGreaterThan(early);
  });

  it("is empty for a player with no games", () => {
    expect(build({ logs: [] })).toEqual([]);
  });
});
