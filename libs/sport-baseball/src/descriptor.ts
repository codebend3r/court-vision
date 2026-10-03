import { memberOf, parsePositionGroups } from "@vision/core/sport/positions";
import { singleYearSeasonLabel } from "@vision/core/sport/season";
import { type SportDescriptor } from "@vision/core/sport/types";

// Per-game stats a valuation line carries; hitters and pitchers share the
// shape. Pitching is counted in outs (3 per inning) so every sum stays an
// integer. `br` is baserunners allowed (hits plus walks), materialized at
// ingest: WHIP's variance needs Σ(h+bb)², which separate h and bb sums cannot
// rebuild.
export const BASEBALL_VALUED_STATS = [
  "r",
  "hr",
  "rbi",
  "sb",
  "h",
  "ab",
  "w",
  "sv",
  "k",
  "er",
  "br",
  "outs",
] as const;

export const BASEBALL_POSITION_GROUPS = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "DH",
  "SP",
  "RP",
] as const;

export type BaseballKeys = {
  valued: (typeof BASEBALL_VALUED_STATS)[number];
  counting: "r" | "hr" | "rbi" | "sb" | "w" | "sv" | "k";
  ratio: "avg" | "era" | "whip";
  scoring: "r" | "hr" | "rbi" | "sb" | "h" | "w" | "sv" | "k" | "er" | "outs";
  group: (typeof BASEBALL_POSITION_GROUPS)[number];
  slot: "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "UTIL" | "SP" | "RP" | "P" | "BENCH" | "IL";
};

// Providers write multi-eligible players as "SS/2B" or "SS,2B".
export const parseBaseballPosition = parsePositionGroups({
  separators: /[/,]/,
  isGroup: memberOf({ values: BASEBALL_POSITION_GROUPS }),
});

const counting = <C extends BaseballKeys["counting"]>(args: {
  key: C;
  label: string;
  fullName: string;
  description: string;
}) => ({
  ...args,
  kind: "counting" as const,
  stat: args.key,
  direction: "higher" as const,
  formula: `(${args.label} − pool avg) ÷ pool std dev × weight`,
});

const HITTER_CATEGORIES = ["r", "hr", "rbi", "sb", "avg"] as const;
const PITCHER_CATEGORIES = ["w", "sv", "k", "era", "whip"] as const;
const HITTER_GROUPS = ["C", "1B", "2B", "3B", "SS", "OF", "DH"] as const;

// Classic 5×5 rotisserie categories.
export const baseball: SportDescriptor<BaseballKeys> = {
  id: "baseball",
  name: "Baseball",
  league: "MLB",
  scheduleGames: 162,
  season: { label: singleYearSeasonLabel },
  // No minutes in baseball: ingest records 1 per game appeared, so playing
  // time counts appearances and the pool floor is games alone.
  playingTime: { label: "G", perUnit: null },
  valuedStats: BASEBALL_VALUED_STATS,
  statLabels: {
    r: "R",
    hr: "HR",
    rbi: "RBI",
    sb: "SB",
    h: "H",
    ab: "AB",
    w: "W",
    sv: "SV",
    k: "K",
    er: "ER",
    br: "H+BB",
    outs: "Outs",
  },
  counting: {
    r: counting({
      key: "r",
      label: "R",
      fullName: "Runs",
      description: "Runs scored relative to the hitter pool.",
    }),
    hr: counting({
      key: "hr",
      label: "HR",
      fullName: "Home Runs",
      description: "Power relative to the hitter pool.",
    }),
    rbi: counting({
      key: "rbi",
      label: "RBI",
      fullName: "Runs Batted In",
      description: "Run production relative to the hitter pool.",
    }),
    sb: counting({
      key: "sb",
      label: "SB",
      fullName: "Stolen Bases",
      description: "Speed, the scarcest hitting category.",
    }),
    w: counting({
      key: "w",
      label: "W",
      fullName: "Wins",
      description: "Pitcher wins relative to the pitcher pool.",
    }),
    sv: counting({
      key: "sv",
      label: "SV",
      fullName: "Saves",
      description: "Saves, almost entirely a closer's category.",
    }),
    k: counting({
      key: "k",
      label: "K",
      fullName: "Strikeouts",
      description: "Pitching strikeouts relative to the pitcher pool.",
    }),
  },
  ratio: {
    avg: {
      kind: "ratio",
      key: "avg",
      numerator: "h",
      denominator: "ab",
      scale: 1,
      direction: "higher",
      label: "AVG",
      fullName: "Batting Average Impact",
      description:
        "Batting average weighted by at-bats, so a full-time hitter's edge counts for more.",
      formula: "AB × (AVG − pool AVG), standardized × weight",
    },
    era: {
      kind: "ratio",
      key: "era",
      numerator: "er",
      denominator: "outs",
      scale: 27,
      direction: "lower",
      label: "ERA",
      fullName: "Earned Run Average Impact",
      description:
        "Earned runs per nine innings, weighted by innings pitched. Fewer runs score higher — the sign is flipped.",
      formula: "IP × (pool ERA − ERA) ÷ 9, standardized × weight",
    },
    whip: {
      kind: "ratio",
      key: "whip",
      numerator: "br",
      denominator: "outs",
      scale: 3,
      direction: "lower",
      label: "WHIP",
      fullName: "Walks + Hits per Inning Impact",
      description:
        "Baserunners allowed per inning, weighted by innings pitched. Fewer runners score higher — the sign is flipped.",
      formula: "IP × (pool WHIP − WHIP), standardized × weight",
    },
  },
  categoryOrder: [...HITTER_CATEGORIES, ...PITCHER_CATEGORIES],
  pools: [
    {
      key: "hitters",
      label: "Hitters",
      groups: [...HITTER_GROUPS],
      categories: [...HITTER_CATEGORIES],
      minGamesShare: 0.3,
      minPlayingTimePerGame: 0,
      poolFloor: 180,
    },
    {
      key: "pitchers",
      label: "Pitchers",
      groups: ["SP", "RP"],
      categories: [...PITCHER_CATEGORIES],
      minGamesShare: 0.1,
      minPlayingTimePerGame: 0,
      poolFloor: 120,
    },
  ],
  // Twelve teams, 22 active: 8 hitting starters plus 2 UTIL, 9 pitchers, and
  // a 3-man bench.
  defaultLeague: { teams: 12, rosterSlots: 22 },
  points: {
    keys: ["r", "hr", "rbi", "sb", "h", "w", "sv", "k", "er", "outs"],
    defaults: { r: 1, hr: 4, rbi: 1, sb: 2, h: 1, w: 5, sv: 5, k: 1, er: -2, outs: 1 },
  },
  positions: {
    groups: BASEBALL_POSITION_GROUPS,
    parse: parseBaseballPosition,
    replacementSlots: { C: 1, "1B": 1, "2B": 1, "3B": 1, SS: 1, OF: 3, DH: 1, SP: 4, RP: 3 },
  },
  slots: [
    {
      type: "C",
      label: "C",
      fullName: "Catcher",
      kind: "starter",
      max: 2,
      defaultCount: 1,
      accepts: ["C"],
    },
    {
      type: "1B",
      label: "1B",
      fullName: "First Base",
      kind: "starter",
      max: 2,
      defaultCount: 1,
      accepts: ["1B"],
    },
    {
      type: "2B",
      label: "2B",
      fullName: "Second Base",
      kind: "starter",
      max: 2,
      defaultCount: 1,
      accepts: ["2B"],
    },
    {
      type: "3B",
      label: "3B",
      fullName: "Third Base",
      kind: "starter",
      max: 2,
      defaultCount: 1,
      accepts: ["3B"],
    },
    {
      type: "SS",
      label: "SS",
      fullName: "Shortstop",
      kind: "starter",
      max: 2,
      defaultCount: 1,
      accepts: ["SS"],
    },
    {
      type: "OF",
      label: "OF",
      fullName: "Outfield",
      kind: "starter",
      max: 5,
      defaultCount: 3,
      accepts: ["OF"],
    },
    {
      type: "UTIL",
      label: "UTIL",
      fullName: "Utility (hitter)",
      kind: "starter",
      max: 3,
      defaultCount: 2,
      accepts: [...HITTER_GROUPS],
    },
    {
      type: "SP",
      label: "SP",
      fullName: "Starting Pitcher",
      kind: "starter",
      max: 5,
      defaultCount: 2,
      accepts: ["SP"],
    },
    {
      type: "RP",
      label: "RP",
      fullName: "Relief Pitcher",
      kind: "starter",
      max: 5,
      defaultCount: 2,
      accepts: ["RP"],
    },
    {
      type: "P",
      label: "P",
      fullName: "Pitcher",
      kind: "starter",
      max: 6,
      defaultCount: 5,
      accepts: ["SP", "RP"],
    },
    {
      type: "BENCH",
      label: "BN",
      fullName: "Bench",
      kind: "bench",
      max: 8,
      defaultCount: 3,
      accepts: "any",
    },
    {
      type: "IL",
      label: "IL",
      fullName: "Injured List",
      kind: "injured",
      max: 4,
      defaultCount: 2,
      accepts: "any",
    },
  ],
  methods: ["zscore", "gscore", "points", "vorp", "positional", "sgp", "simvalue"],
  replacementBase: "z",
  methodCopy: {},
};
