import { memberOf, parsePositionGroups } from "@vision/core/sport/positions";
import { singleYearSeasonLabel } from "@vision/core/sport/season";
import { type SportDescriptor } from "@vision/core/sport/types";

// Per-game stats a valuation line carries. Team defense's points-allowed
// tiers are not linear, so ingest stores `dstPoints` already tiered and the
// table scores it at ×1.
export const FOOTBALL_VALUED_STATS = [
  "passYds",
  "passTd",
  "passInt",
  "rushYds",
  "rushTd",
  "rec",
  "recYds",
  "recTd",
  "fumLost",
  "fgMade",
  "xpMade",
  "dstPoints",
] as const;

export const FOOTBALL_POSITION_GROUPS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

// Football fantasy is points-only: no counting or ratio categories.
export type FootballKeys = {
  valued: (typeof FOOTBALL_VALUED_STATS)[number];
  counting: never;
  ratio: never;
  scoring: (typeof FOOTBALL_VALUED_STATS)[number];
  group: (typeof FOOTBALL_POSITION_GROUPS)[number];
  slot: "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DEF" | "BENCH" | "IR";
};

export const parseFootballPosition = parsePositionGroups({
  separators: /[/,]/,
  isGroup: memberOf({ values: FOOTBALL_POSITION_GROUPS }),
});

// Full-PPR scoring, valued by points over the replacement player at each
// position (VORP is the standard football draft value).
export const football: SportDescriptor<FootballKeys> = {
  id: "football",
  name: "Football",
  league: "NFL",
  scheduleGames: 17,
  season: { label: singleYearSeasonLabel },
  // Ingest records 1 per game active; snaps vary too much by role to gate on.
  playingTime: { label: "G", perUnit: null },
  valuedStats: FOOTBALL_VALUED_STATS,
  statLabels: {
    passYds: "Pass Yds",
    passTd: "Pass TD",
    passInt: "INT",
    rushYds: "Rush Yds",
    rushTd: "Rush TD",
    rec: "Rec",
    recYds: "Rec Yds",
    recTd: "Rec TD",
    fumLost: "Fum Lost",
    fgMade: "FG",
    xpMade: "XP",
    dstPoints: "DEF Pts",
  },
  counting: {},
  ratio: {},
  categoryOrder: [],
  pools: [
    {
      key: "all",
      label: "All players",
      groups: "all",
      categories: [],
      minGamesShare: 0.3,
      minPlayingTimePerGame: 0,
      poolFloor: 200,
    },
  ],
  // Twelve teams: QB, 2 RB, 2 WR, TE, FLEX, K, DEF, and a 6-man bench.
  defaultLeague: { teams: 12, rosterSlots: 15 },
  points: {
    keys: FOOTBALL_VALUED_STATS,
    defaults: {
      passYds: 0.04,
      passTd: 4,
      passInt: -2,
      rushYds: 0.1,
      rushTd: 6,
      rec: 1,
      recYds: 0.1,
      recTd: 6,
      fumLost: -2,
      fgMade: 3,
      xpMade: 1,
      dstPoints: 1,
    },
  },
  positions: {
    groups: FOOTBALL_POSITION_GROUPS,
    parse: parseFootballPosition,
    replacementSlots: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 },
  },
  slots: [
    {
      type: "QB",
      label: "QB",
      fullName: "Quarterback",
      kind: "starter",
      max: 2,
      defaultCount: 1,
      accepts: ["QB"],
    },
    {
      type: "RB",
      label: "RB",
      fullName: "Running Back",
      kind: "starter",
      max: 3,
      defaultCount: 2,
      accepts: ["RB"],
    },
    {
      type: "WR",
      label: "WR",
      fullName: "Wide Receiver",
      kind: "starter",
      max: 4,
      defaultCount: 2,
      accepts: ["WR"],
    },
    {
      type: "TE",
      label: "TE",
      fullName: "Tight End",
      kind: "starter",
      max: 2,
      defaultCount: 1,
      accepts: ["TE"],
    },
    {
      type: "FLEX",
      label: "FLEX",
      fullName: "Flex (RB/WR/TE)",
      kind: "starter",
      max: 3,
      defaultCount: 1,
      accepts: ["RB", "WR", "TE"],
    },
    {
      type: "K",
      label: "K",
      fullName: "Kicker",
      kind: "starter",
      max: 1,
      defaultCount: 1,
      accepts: ["K"],
    },
    {
      type: "DEF",
      label: "DEF",
      fullName: "Team Defense",
      kind: "starter",
      max: 1,
      defaultCount: 1,
      accepts: ["DEF"],
    },
    {
      type: "BENCH",
      label: "BN",
      fullName: "Bench",
      kind: "bench",
      max: 10,
      defaultCount: 6,
      accepts: "any",
    },
    {
      type: "IR",
      label: "IR",
      fullName: "Injured Reserve",
      kind: "injured",
      max: 3,
      defaultCount: 1,
      accepts: "any",
    },
  ],
  methods: ["points", "vorp", "positional"],
  replacementBase: "points",
  methodCopy: {
    points: {
      description:
        "The stat line priced in full-PPR scoring: 0.04 per passing yard, 4 per passing TD, 0.1 per rushing or receiving yard, 6 per TD, 1 per catch.",
      formula: "Σ per stat: total × points per unit",
    },
    vorp: {
      description:
        "Points surplus over the last rostered player in your league (rank = teams × roster slots).",
      formula: "points(player) − points(replacement at teams × slots)",
    },
    positional: {
      description:
        "Points surplus over the replacement player at this player's position — the classic draft value.",
      formula: "points(player) − points(position replacement)",
      whyItMatters:
        "A running back who outscores the next-best running back by 80 points is worth more than a quarterback 80 points better than an average quarterback, because quarterbacks are plentiful. Draft by this column.",
    },
  },
};
