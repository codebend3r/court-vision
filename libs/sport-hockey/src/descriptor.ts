import { memberOf, parsePositionGroups } from "@vision/core/sport/positions";
import { crossYearSeasonLabel } from "@vision/core/sport/season";
import { type SportDescriptor } from "@vision/core/sport/types";

// Per-game stats a valuation line carries. Skaters and goalies share one line
// shape; a skater's goalie stats are simply zero, and vice versa. `toi` is time
// on ice in minutes: the playing time, and GAA's denominator.
export const HOCKEY_VALUED_STATS = [
  "g",
  "a",
  "pm",
  "ppp",
  "sog",
  "hit",
  "blk",
  "w",
  "so",
  "ga",
  "sv",
  "sa",
  "toi",
] as const;

export const HOCKEY_POSITION_GROUPS = ["C", "LW", "RW", "D", "G"] as const;

export type HockeyKeys = {
  valued: (typeof HOCKEY_VALUED_STATS)[number];
  counting: "g" | "a" | "pm" | "ppp" | "sog" | "hit" | "blk" | "w" | "so";
  ratio: "gaa" | "svp";
  scoring: "g" | "a" | "pm" | "ppp" | "sog" | "hit" | "blk" | "w" | "so" | "ga" | "sv";
  group: (typeof HOCKEY_POSITION_GROUPS)[number];
  slot: "C" | "LW" | "RW" | "D" | "UTIL" | "G" | "BENCH" | "IR";
};

// Providers write multi-eligible skaters as "C/LW" or "C,LW".
export const parseHockeyPosition = parsePositionGroups({
  separators: /[/,]/,
  isGroup: memberOf({ values: HOCKEY_POSITION_GROUPS }),
});

const counting = <C extends HockeyKeys["counting"]>(args: {
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

const SKATER_CATEGORIES = ["g", "a", "pm", "ppp", "sog", "hit", "blk"] as const;
const GOALIE_CATEGORIES = ["w", "gaa", "svp", "so"] as const;

// Yahoo's default head-to-head categories: seven skater, four goalie.
export const hockey: SportDescriptor<HockeyKeys> = {
  id: "hockey",
  name: "Hockey",
  league: "NHL",
  scheduleGames: 82,
  season: { label: crossYearSeasonLabel },
  playingTime: { label: "TOI", perUnit: 60 },
  valuedStats: HOCKEY_VALUED_STATS,
  statLabels: {
    g: "G",
    a: "A",
    pm: "+/-",
    ppp: "PPP",
    sog: "SOG",
    hit: "HIT",
    blk: "BLK",
    w: "W",
    so: "SO",
    ga: "GA",
    sv: "SV",
    sa: "SA",
    toi: "TOI",
  },
  counting: {
    g: counting({
      key: "g",
      label: "G",
      fullName: "Goals",
      description: "Goal scoring relative to the skater pool.",
    }),
    a: counting({
      key: "a",
      label: "A",
      fullName: "Assists",
      description: "Playmaking relative to the skater pool.",
    }),
    pm: counting({
      key: "pm",
      label: "+/-",
      fullName: "Plus/Minus",
      description: "Goal differential while on the ice; it can run negative.",
    }),
    ppp: counting({
      key: "ppp",
      label: "PPP",
      fullName: "Power-Play Points",
      description: "Goals and assists on the power play.",
    }),
    sog: counting({
      key: "sog",
      label: "SOG",
      fullName: "Shots on Goal",
      description: "Shot volume, the steadiest skater category.",
    }),
    hit: counting({
      key: "hit",
      label: "HIT",
      fullName: "Hits",
      description: "Physical play relative to the skater pool.",
    }),
    blk: counting({
      key: "blk",
      label: "BLK",
      fullName: "Blocked Shots",
      description: "Shot blocking, mostly a defenseman's category.",
    }),
    w: counting({
      key: "w",
      label: "W",
      fullName: "Wins",
      description: "Goalie wins relative to the goalie pool.",
    }),
    so: counting({
      key: "so",
      label: "SO",
      fullName: "Shutouts",
      description: "Shutouts relative to the goalie pool.",
    }),
  },
  ratio: {
    gaa: {
      kind: "ratio",
      key: "gaa",
      numerator: "ga",
      denominator: "toi",
      scale: 60,
      direction: "lower",
      label: "GAA",
      fullName: "Goals Against Average",
      description:
        "Goals allowed per 60 minutes, weighted by minutes played. Fewer goals score higher — the sign is flipped.",
      formula: "TOI × (pool GAA − GAA) ÷ 60, standardized × weight",
    },
    svp: {
      kind: "ratio",
      key: "svp",
      numerator: "sv",
      denominator: "sa",
      scale: 1,
      direction: "higher",
      label: "SV%",
      fullName: "Save Percentage Impact",
      description:
        "Save percentage weighted by shots faced, so a workhorse's edge counts for more.",
      formula: "SA × (SV% − pool SV%), standardized × weight",
    },
  },
  categoryOrder: [...SKATER_CATEGORIES, ...GOALIE_CATEGORIES],
  pools: [
    {
      key: "skaters",
      label: "Skaters",
      groups: ["C", "LW", "RW", "D"],
      categories: [...SKATER_CATEGORIES],
      minGamesShare: 0.3,
      minPlayingTimePerGame: 10,
      poolFloor: 200,
    },
    {
      key: "goalies",
      label: "Goalies",
      groups: ["G"],
      categories: [...GOALIE_CATEGORIES],
      minGamesShare: 0.2,
      minPlayingTimePerGame: 30,
      poolFloor: 40,
    },
  ],
  // Twelve teams: 2 C, 2 LW, 2 RW, 4 D, 1 UTIL, 2 G, and a 4-man bench.
  defaultLeague: { teams: 12, rosterSlots: 17 },
  points: {
    keys: ["g", "a", "pm", "ppp", "sog", "hit", "blk", "w", "so", "ga", "sv"],
    defaults: {
      g: 3,
      a: 2,
      pm: 1,
      ppp: 1,
      sog: 0.4,
      hit: 0.2,
      blk: 0.4,
      w: 4,
      so: 3,
      ga: -2,
      sv: 0.2,
    },
  },
  positions: {
    groups: HOCKEY_POSITION_GROUPS,
    parse: parseHockeyPosition,
    replacementSlots: { C: 2, LW: 2, RW: 2, D: 4, G: 2 },
  },
  slots: [
    {
      type: "C",
      label: "C",
      fullName: "Center",
      kind: "starter",
      max: 4,
      defaultCount: 2,
      accepts: ["C"],
    },
    {
      type: "LW",
      label: "LW",
      fullName: "Left Wing",
      kind: "starter",
      max: 4,
      defaultCount: 2,
      accepts: ["LW"],
    },
    {
      type: "RW",
      label: "RW",
      fullName: "Right Wing",
      kind: "starter",
      max: 4,
      defaultCount: 2,
      accepts: ["RW"],
    },
    {
      type: "D",
      label: "D",
      fullName: "Defense",
      kind: "starter",
      max: 6,
      defaultCount: 4,
      accepts: ["D"],
    },
    {
      type: "UTIL",
      label: "UTIL",
      fullName: "Utility (skater)",
      kind: "starter",
      max: 3,
      defaultCount: 1,
      accepts: ["C", "LW", "RW", "D"],
    },
    {
      type: "G",
      label: "G",
      fullName: "Goalie",
      kind: "starter",
      max: 3,
      defaultCount: 2,
      accepts: ["G"],
    },
    {
      type: "BENCH",
      label: "BN",
      fullName: "Bench",
      kind: "bench",
      max: 8,
      defaultCount: 4,
      accepts: "any",
    },
    {
      type: "IR",
      label: "IR",
      fullName: "Injured Reserve",
      kind: "injured",
      max: 4,
      defaultCount: 2,
      accepts: "any",
    },
  ],
  methods: ["zscore", "gscore", "points", "vorp", "positional", "sgp", "simvalue"],
  replacementBase: "z",
  methodCopy: {
    positional: {
      description:
        "Z-Score surplus over the replacement player at the scarcest position this player can fill (C/LW/RW/D/G).",
    },
  },
};
