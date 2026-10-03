import { describe, expect, it } from "bun:test";

import { type TeamGameResult } from "@vision/core/series/teamTrend";
import { createPrng, gaussian } from "@vision/core/util/prng";

import { buildPlayerInsights } from "@/lib/fantasyTeams/insights";
import {
  autoAssignSlotId,
  buildSlots,
  DEFAULT_SLOT_COUNTS,
  eligibleForSlot,
  SLOT_META,
} from "@/lib/fantasyTeams/slots";
import { type FantasyTeamPlayer, type RosterSlot } from "@/lib/fantasyTeams/types";
import {
  aggregateCareerTotals,
  buildCareerAverageLine,
  buildSeasonAverageLine,
  type SeasonStatTotals,
} from "@/lib/players/seasonAverages";
import { buildStatSeries, type CumulativeSourceLog } from "@/lib/stats/cumulative";
import { type StatMode } from "@/lib/stats/searchParams";
import { buildTeamStats, rankTeams, type TeamBoxTotals } from "@/lib/teams/stats";
import { aggregateWindowLogs } from "@/lib/valuation/aggregate";
import { buildCategoryBreakdown } from "@/lib/valuation/breakdown";
import { CATEGORY_KEYS, CATEGORY_META } from "@/lib/valuation/categories";
import { buildFantasyGameValues } from "@/lib/valuation/gameValues";
import { valuePlayers } from "@/lib/valuation/index";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";
import { standingsGainDenominators } from "@/lib/valuation/methods/sgp";
import { parseEligibleGroups, positionalValues } from "@/lib/valuation/modifiers/positional";
import { buildPlayerFantasyProfile, type FantasyProfileLog } from "@/lib/valuation/playerValue";
import { attemptWeightedPcts, computePoolStats } from "@/lib/valuation/pool";
import { FANTASY_METHODS } from "@/lib/valuation/registry";
import { buildLeague } from "@/lib/valuation/rosters";
import { buildFantasyTrend } from "@/lib/valuation/trend";
import {
  type Category,
  type FantasyStatLine,
  type MethodWeights,
  type PoolStats,
  type ValuationConfig,
} from "@/lib/valuation/types";
import { buildRollingGSeries, buildRollingZSeries } from "@/lib/watchlist/trend";

// Golden master for the sport-descriptor refactor of the valuation engine.
//
// Every number the engine and its neighbours produce over a seeded synthetic
// season is serialized exactly (shortest round-trip decimal, `-0` and NaN kept
// distinct) and pinned by snapshot. The refactor must reproduce them bit for
// bit: never update these snapshots to make a change pass. Run with `CI=true`
// so Bun refuses to write a missing snapshot instead of silently creating it.

// ---------------------------------------------------------------------------
// Canonical serialization
// ---------------------------------------------------------------------------

const canonicalNumber = (value: number): string => {
  if (Object.is(value, -0)) return "-0";
  if (Number.isNaN(value)) return "NaN";
  return String(value);
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonical = (value: unknown): string => {
  if (typeof value === "number") return canonicalNumber(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean" || value === null || value === undefined) return String(value);
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (value instanceof Map) return `Map[${[...value.entries()].map(canonical).join(",")}]`;
  if (value instanceof Set) return `Set[${[...value.values()].map(canonical).join(",")}]`;
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return `?${typeof value}`;
};

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");

// A snapshot entry: the hash pins every value, the sample keeps a readable
// slice so a failure shows what moved.
const golden = ({ value, sample }: { value: unknown; sample?: unknown }) => ({
  sha256: sha256(canonical(value)),
  sample: canonical(sample ?? value).slice(0, 4000),
});

// ---------------------------------------------------------------------------
// Seeded synthetic season (independent of the engine under test)
// ---------------------------------------------------------------------------

const POSITIONS: readonly (string | null)[] = [
  "G",
  "F",
  "C",
  "G-F",
  "F-C",
  "C-F",
  "PG",
  "",
  null,
  "F-G",
];
const TEAMS = Array.from({ length: 30 }, (_, index) => `T${String(index).padStart(2, "0")}`);
const PLAYER_COUNT = 220;
const SEASON_START = Date.UTC(2025, 9, 21);

type FlatLog = {
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg3m: number;
  fg3a: number;
  tov: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  gameDate: Date;
  gameId: string;
  matchup: string;
  winLoss: string | null;
};

type SyntheticPlayer = {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string;
  position: string | null;
  logs: FlatLog[];
};

const gamesFor = (index: number): number => {
  if (index % 37 === 0) return 1;
  if (index % 41 === 0) return 8;
  return 60;
};

const syntheticPlayer = (index: number): SyntheticPlayer => {
  const rng = createPrng(0xc0ffee + index * 7919);
  const minutesBase = 8 + rng() * 30;
  const shooter = 0.35 + rng() * 0.2;
  const noFreeThrows = index % 23 === 0;
  const teamAbbr = TEAMS[index % TEAMS.length] ?? "T00";
  const logs = Array.from({ length: gamesFor(index) }, (_, game): FlatLog => {
    const base = {
      gameDate: new Date(SEASON_START + game * 2 * 86_400_000),
      gameId: `g${index}-${game}`,
      matchup: `${teamAbbr} vs. OPP`,
      winLoss: rng() < 0.5 ? "W" : "L",
    };
    if (rng() < 0.08) {
      return {
        ...base,
        minutes: 0,
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        fg3m: 0,
        fg3a: 0,
        tov: 0,
        fgm: 0,
        fga: 0,
        ftm: 0,
        fta: 0,
      };
    }
    const minutes = Math.max(1, Math.round(gaussian({ rng, mean: minutesBase, spread: 4 })));
    const fga = Math.round(minutes * (0.25 + rng() * 0.3));
    const fgm = Math.min(fga, Math.round(fga * (shooter + (rng() - 0.5) * 0.2)));
    const fg3a = Math.round(fga * rng() * 0.5);
    const fg3m = Math.min(fg3a, Math.round(fg3a * (0.25 + rng() * 0.2)));
    const fta = noFreeThrows ? 0 : Math.round(minutes * rng() * 0.2);
    const ftm = Math.min(fta, Math.round(fta * (0.6 + rng() * 0.35)));
    return {
      ...base,
      minutes,
      pts: 2 * fgm + fg3m + ftm,
      reb: Math.round(minutes * rng() * 0.35),
      ast: Math.round(minutes * rng() * 0.25),
      stl: Math.round(rng() * 2.5),
      blk: Math.round(rng() * rng() * 3),
      fg3m,
      fg3a,
      tov: Math.round(rng() * 3.5),
      fgm,
      fga,
      ftm,
      fta,
    };
  });
  return {
    playerId: index + 1,
    firstName: `First${index}`,
    lastName: `Last${index}`,
    fullName: `First${index} Last${index}`,
    teamAbbr,
    position: POSITIONS[index % POSITIONS.length] ?? null,
    logs,
  };
};

const PLAYERS = Array.from({ length: PLAYER_COUNT }, (_, index) => syntheticPlayer(index));

// ---------------------------------------------------------------------------
// Engine adapter: the ONLY section the refactor may edit. It maps the fixed
// synthetic inputs onto whatever the engine's current API is, and projects
// outputs onto a stable shape. The numbers themselves must not change.
// ---------------------------------------------------------------------------

type WindowRange = "all" | "last10";

const toWindowLog = (log: FlatLog) => ({
  minutes: log.minutes,
  pts: log.pts,
  reb: log.reb,
  ast: log.ast,
  stl: log.stl,
  blk: log.blk,
  fg3m: log.fg3m,
  tov: log.tov,
  fgm: log.fgm,
  fga: log.fga,
  ftm: log.ftm,
  fta: log.fta,
});

const toDatedLog = (log: FlatLog) => ({ ...toWindowLog(log), gameDate: log.gameDate });

const toProfileLog = (log: FlatLog): FantasyProfileLog => ({
  ...toDatedLog(log),
  gameId: log.gameId,
  matchup: log.matchup,
  winLoss: log.winLoss,
});

const toLine = (player: SyntheticPlayer): FantasyStatLine => ({
  playerId: player.playerId,
  firstName: player.firstName,
  lastName: player.lastName,
  fullName: player.fullName,
  teamAbbr: player.teamAbbr,
  position: player.position,
  nbaPersonId: null,
  ...aggregateWindowLogs({ logs: player.logs.map(toWindowLog) }),
});

const projectPool = (poolStats: PoolStats) => ({
  poolSize: poolStats.poolSize,
  leagueFgPct: poolStats.leagueFgPct,
  leagueFtPct: poolStats.leagueFtPct,
  byCategory: poolStats.byCategory,
});

const projectLine = (line: FantasyStatLine) => ({
  playerId: line.playerId,
  gamesPlayed: line.gamesPlayed,
  minutes: line.minutes,
  stats: {
    pts: line.pts,
    reb: line.reb,
    ast: line.ast,
    stl: line.stl,
    blk: line.blk,
    fg3m: line.fg3m,
    tov: line.tov,
    fgm: line.fgm,
    fga: line.fga,
    ftm: line.ftm,
    fta: line.fta,
  },
  sq: line.sq,
  cross: line.cross,
});

const runValuePlayers = ({
  lines,
  config,
  methodWeights,
  range,
}: {
  lines: readonly FantasyStatLine[];
  config: ValuationConfig;
  methodWeights: MethodWeights;
  range: WindowRange;
}) => {
  const { values, poolStats } = valuePlayers({ lines, config, methodWeights, range });
  return { values, poolStats: projectPool(poolStats) };
};

const runPoolStats = ({
  lines,
  basis,
  poolSize,
  range,
}: {
  lines: readonly FantasyStatLine[];
  basis: ValuationConfig["basis"];
  poolSize: number;
  range: WindowRange;
}) => computePoolStats({ lines, basis, poolSize, range });

const runLeaguePcts = ({ lines }: { lines: readonly FantasyStatLine[] }) =>
  attemptWeightedPcts({ lines });

// ---------------------------------------------------------------------------
// Fixed inputs
// ---------------------------------------------------------------------------

const LINES = PLAYERS.map(toLine);

const baseConfig = (overrides: Partial<ValuationConfig> = {}): ValuationConfig => ({
  categories: [...CATEGORY_KEYS],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: DEFAULT_POINTS_SCORING,
  ...overrides,
});

const PUNT: readonly Category[] = ["ft", "tov"];

const CONFIG_VARIANTS: readonly {
  name: string;
  config: ValuationConfig;
  methodWeights: MethodWeights;
}[] = [
  { name: "all categories", config: baseConfig(), methodWeights: {} },
  {
    name: "punt ft+tov",
    config: baseConfig({ categories: CATEGORY_KEYS.filter((key) => !PUNT.includes(key)) }),
    methodWeights: {},
  },
  {
    name: "weights pts×2 tov×0",
    config: baseConfig({ weights: { pts: 2, tov: 0 } }),
    methodWeights: {},
  },
  {
    name: "per-method weights",
    config: baseConfig(),
    methodWeights: {
      z: { pts: 2 },
      g: { reb: 0 },
      vorp: { ast: 1.5 },
      pos: { blk: 0.5 },
      sgp: { stl: 2 },
      sim: { fg: 0 },
    },
  },
  {
    name: "8 teams × 10 slots",
    config: baseConfig({ teams: 8, rosterSlots: 10 }),
    methodWeights: {},
  },
  {
    name: "14 teams × 15 slots",
    config: baseConfig({ teams: 14, rosterSlots: 15 }),
    methodWeights: {},
  },
  {
    name: "custom points scoring",
    config: baseConfig({
      scoring: { pts: 1, reb: 1, ast: 1, stl: 2, blk: 2, fg3m: 0.5, tov: -2 },
    }),
    methodWeights: {},
  },
];

const BASES: readonly ValuationConfig["basis"][] = ["perGame", "total"];
const RANGES: readonly WindowRange[] = ["all", "last10"];

const SAMPLE_IDS = new Set([1, 2, 3, 38, 42, 100, 219]);

// ---------------------------------------------------------------------------
// Golden cases
// ---------------------------------------------------------------------------

describe("valuation golden master", () => {
  it("aggregates every synthetic season into the same stat lines", () => {
    const projected = LINES.map(projectLine);
    expect(golden({ value: projected, sample: projected.slice(0, 3) })).toMatchSnapshot();
  });

  it("derives the same league shooting percentages", () => {
    expect(golden({ value: runLeaguePcts({ lines: LINES }) })).toMatchSnapshot();
  });

  BASES.forEach((basis) => {
    RANGES.forEach((range) => {
      it(`computes the same pool stats (${basis}, ${range})`, () => {
        const pool = runPoolStats({ lines: LINES, basis, poolSize: 150, range });
        expect(golden({ value: projectPool(pool) })).toMatchSnapshot();
      });

      CONFIG_VARIANTS.forEach(({ name, config, methodWeights }) => {
        it(`values every player the same way (${basis}, ${range}, ${name})`, () => {
          const result = runValuePlayers({
            lines: LINES,
            config: { ...config, basis },
            methodWeights,
            range,
          });
          expect(
            golden({
              value: result,
              sample: {
                poolStats: result.poolStats.poolSize,
                values: result.values.filter((entry) => SAMPLE_IDS.has(entry.playerId)),
              },
            }),
          ).toMatchSnapshot();
        });
      });
    });
  });

  it("drafts the same synthetic league and SGP denominators", () => {
    const config = baseConfig();
    const pool = runPoolStats({ lines: LINES, basis: "perGame", poolSize: 156, range: "all" });
    const punted = baseConfig({ categories: CATEGORY_KEYS.filter((key) => !PUNT.includes(key)) });
    const value = {
      league: buildLeague({ lines: LINES, poolStats: pool, config }),
      puntedLeague: buildLeague({ lines: LINES, poolStats: pool, config: punted }),
      denominators: standingsGainDenominators({ lines: LINES, poolStats: pool, config }),
      puntedDenominators: standingsGainDenominators({
        lines: LINES,
        poolStats: pool,
        config: punted,
      }),
    };
    expect(golden({ value })).toMatchSnapshot();
  });

  it("breaks the same players down by category", () => {
    const config = baseConfig();
    const pool = runPoolStats({ lines: LINES, basis: "perGame", poolSize: 156, range: "all" });
    const value = LINES.filter((line) => SAMPLE_IDS.has(line.playerId)).map((line) =>
      buildCategoryBreakdown({
        line,
        poolStats: pool,
        config,
        methodWeights: { z: { pts: 2 }, g: { tov: 0 } },
      }),
    );
    expect(golden({ value })).toMatchSnapshot();
  });

  it("scores the same game values, trends, and rolling series", () => {
    const config = baseConfig();
    const pool = runPoolStats({ lines: LINES, basis: "perGame", poolSize: 156, range: "all" });
    const value = PLAYERS.filter((player) => SAMPLE_IDS.has(player.playerId)).map((player) => {
      const line = LINES.find((entry) => entry.playerId === player.playerId);
      const logs = player.logs.map(toDatedLog);
      if (line === undefined) return null;
      return {
        games: buildFantasyGameValues({ line, logs, poolStats: pool, config, methodWeights: {} }),
        trendAll: buildFantasyTrend({
          line,
          logs,
          poolStats: pool,
          config,
          methodWeights: { z: { pts: 2 } },
          windowGames: null,
        }),
        trend15: buildFantasyTrend({
          line,
          logs,
          poolStats: pool,
          config,
          methodWeights: {},
          windowGames: 15,
        }),
        rollingZ: buildRollingZSeries({
          playerId: player.playerId,
          fullName: player.fullName,
          logs,
          poolStats: pool,
          config,
        }),
        rollingG: buildRollingGSeries({
          playerId: player.playerId,
          fullName: player.fullName,
          logs,
          poolStats: pool,
          config,
          windowSize: 5,
        }),
      };
    });
    expect(golden({ value, sample: value[0]?.games.slice(0, 3) })).toMatchSnapshot();
  });

  it("builds the same player fantasy profiles", () => {
    const value = [1, 2, 100].map((playerId) => {
      const player = PLAYERS.find((entry) => entry.playerId === playerId);
      return buildPlayerFantasyProfile({
        lines: LINES,
        playerId,
        config: baseConfig(),
        methodWeights: { sgp: { stl: 2 } },
        range: "all",
        logs: (player?.logs ?? []).map(toProfileLog),
        windowGames: 20,
      });
    });
    expect(golden({ value, sample: value[0]?.readouts })).toMatchSnapshot();
  });

  it("builds the same team-builder insights", () => {
    const value = buildPlayerInsights({ lines: LINES });
    expect(golden({ value, sample: value.slice(0, 2) })).toMatchSnapshot();
  });

  it("parses positions and values positional scarcity the same way", () => {
    const positions = [...POSITIONS, "g-f", " C ", "F-F", "PF", "G-F-C", "UTIL"];
    const players = LINES.map((line, index) => ({
      playerId: line.playerId,
      total: (index % 17) - 8 + index / 1000,
      position: line.position,
    }));
    const value = {
      parsed: positions.map((position) => parseEligibleGroups(position)),
      positional: positionalValues({ players, teams: 12, fallbackReplacement: -1.25 }),
    };
    expect(golden({ value })).toMatchSnapshot();
  });

  it("decides slot eligibility and auto-assignment the same way", () => {
    const positions = [...POSITIONS, "G-F-C", "UTIL"];
    const matrix = SLOT_META.map((meta) =>
      positions.map((position) => eligibleForSlot({ slotType: meta.type, position })),
    );
    const player = (playerId: number, position: string | null): FantasyTeamPlayer => ({
      playerId,
      firstName: "A",
      lastName: "B",
      fullName: "A B",
      teamAbbr: null,
      position,
      nbaPersonId: null,
    });
    const slots = buildSlots({ counts: DEFAULT_SLOT_COUNTS });
    const filled: RosterSlot[] = slots.map((slot) =>
      slot.type === "PG" ? { ...slot, player: player(99, "G") } : slot,
    );
    const assignments = positions.map((position, index) =>
      autoAssignSlotId({ slots: filled, player: player(index + 1, position) }),
    );
    expect(golden({ value: { matrix, assignments } })).toMatchSnapshot();
  });

  it("keeps the same method and category copy", () => {
    expect(
      golden({ value: { methods: FANTASY_METHODS, categories: CATEGORY_META } }),
    ).toMatchSnapshot();
  });

  it("builds the same cumulative stat series in every mode", () => {
    const modes: readonly StatMode[] = ["game", "avg", "totals", "per36"];
    const value = PLAYERS.filter((player) => SAMPLE_IDS.has(player.playerId)).map((player) => {
      const logs: CumulativeSourceLog[] = player.logs;
      return modes.map((mode) => buildStatSeries({ logs, mode }));
    });
    expect(golden({ value, sample: value[0]?.[1]?.slice(0, 2) })).toMatchSnapshot();
  });

  it("ranks the same season and career averages", () => {
    const rows: SeasonStatTotals[] = PLAYERS.map((player) => {
      const played = player.logs.filter((log) => log.minutes > 0);
      const sum = (pick: (log: FlatLog) => number): number =>
        played.reduce((total, log) => total + pick(log), 0);
      return {
        playerId: player.playerId,
        gamesPlayed: played.length,
        minutes: sum((log) => log.minutes),
        fgm: sum((log) => log.fgm) * 4,
        fga: sum((log) => log.fga) * 4,
        fg3m: sum((log) => log.fg3m) * 4,
        fg3a: sum((log) => log.fg3a) * 4,
        ftm: sum((log) => log.ftm) * 4,
        fta: sum((log) => log.fta) * 4,
        reb: sum((log) => log.reb),
        ast: sum((log) => log.ast),
        stl: sum((log) => log.stl),
        blk: sum((log) => log.blk),
        tov: sum((log) => log.tov),
        pts: sum((log) => log.pts),
      };
    });
    const value = [1, 2, 38, 100].map((playerId) => {
      const career = aggregateCareerTotals({ rows: [...rows, ...rows], playerId });
      return {
        season: buildSeasonAverageLine({ rows, playerId }),
        unqualified: buildSeasonAverageLine({ rows, playerId, applyMinimums: false }),
        career: career === null ? null : buildCareerAverageLine({ totals: career }),
      };
    });
    expect(golden({ value })).toMatchSnapshot();
  });

  it("builds and ranks the same team stats", () => {
    const results: TeamGameResult[] = PLAYERS.slice(0, 60).flatMap((player) =>
      player.logs.slice(0, 20).map((log, index) => ({
        teamAbbr: player.teamAbbr,
        gameId: `${player.teamAbbr}-${index}`,
        teamScore: index % 7 === 0 ? null : 90 + (player.playerId % 30) + index,
        opponentScore: 95 + (index % 11),
        winLoss: log.winLoss,
        gameDate: log.gameDate,
      })),
    );
    const totals: TeamBoxTotals[] = TEAMS.map((teamAbbr, index) => ({
      teamAbbr,
      pts: 2000 + index * 13,
      reb: 900 + (index % 7) * 11,
      ast: 500 + (index % 5) * 9,
      stl: 150 + (index % 3),
      blk: 100 + (index % 4),
      tov: 300 - (index % 6),
      fg3m: 250 + index,
      fgm: 800 + index * 2,
      fga: 1700 + index * 3,
      ftm: 300 + index,
      fta: 380 + index,
    }));
    const stats = buildTeamStats({ results, totals });
    expect(golden({ value: { stats, ranks: rankTeams({ stats }) } })).toMatchSnapshot();
  });
});
