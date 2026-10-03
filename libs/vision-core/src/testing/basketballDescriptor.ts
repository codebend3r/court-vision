import { memberOf, parsePositionGroups } from "#core/sport/positions";
import { crossYearSeasonLabel } from "#core/sport/season";
import { type SportDescriptor } from "#core/sport/types";

// A copy of @vision/sport-basketball's descriptor for core's own tests. Core
// may not depend on a sport lib (the dependency runs the other way), but its
// engine tests are written against basketball numbers. sport-basketball's
// drift test fails if this copy and the real descriptor ever disagree.

// Per-game box-score stats a valuation line carries.
export const VALUED_STATS = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fg3m",
  "tov",
  "fgm",
  "fga",
  "ftm",
  "fta",
] as const;

export const POSITION_GROUPS = ["G", "F", "C"] as const;

export type BasketballKeys = {
  valued: (typeof VALUED_STATS)[number];
  counting: "pts" | "reb" | "ast" | "stl" | "blk" | "tpm" | "tov";
  ratio: "fg" | "ft";
  scoring: "pts" | "reb" | "ast" | "stl" | "blk" | "fg3m" | "tov";
  group: (typeof POSITION_GROUPS)[number];
  slot: "PG" | "SG" | "SF" | "PF" | "C" | "G" | "F" | "UTIL" | "BENCH" | "IL" | "ILPLUS";
};

// Balldontlie positions are "G", "F-C", "G-F", … — split on the hyphen and
// keep the recognized groups.
export const parsePosition = parsePositionGroups({
  separators: /-/,
  isGroup: memberOf({ values: POSITION_GROUPS }),
});

export const basketballFixture: SportDescriptor<BasketballKeys> = {
  id: "basketball",
  name: "Basketball",
  league: "NBA",
  scheduleGames: 82,
  season: { label: crossYearSeasonLabel },
  playingTime: { label: "MIN", perUnit: 36 },
  valuedStats: VALUED_STATS,
  counting: {
    pts: {
      kind: "counting",
      key: "pts",
      stat: "pts",
      direction: "higher",
      label: "PTS",
      fullName: "Points",
      description: "Scoring contribution relative to the player pool.",
      formula: "(PTS − pool avg) ÷ pool std dev × weight",
    },
    reb: {
      kind: "counting",
      key: "reb",
      stat: "reb",
      direction: "higher",
      label: "REB",
      fullName: "Rebounds",
      description: "Rebounding contribution relative to the player pool.",
      formula: "(REB − pool avg) ÷ pool std dev × weight",
    },
    ast: {
      kind: "counting",
      key: "ast",
      stat: "ast",
      direction: "higher",
      label: "AST",
      fullName: "Assists",
      description: "Playmaking contribution relative to the player pool.",
      formula: "(AST − pool avg) ÷ pool std dev × weight",
    },
    stl: {
      kind: "counting",
      key: "stl",
      stat: "stl",
      direction: "higher",
      label: "STL",
      fullName: "Steals",
      description: "Steals contribution relative to the player pool.",
      formula: "(STL − pool avg) ÷ pool std dev × weight",
    },
    blk: {
      kind: "counting",
      key: "blk",
      stat: "blk",
      direction: "higher",
      label: "BLK",
      fullName: "Blocks",
      description: "Shot-blocking contribution relative to the player pool.",
      formula: "(BLK − pool avg) ÷ pool std dev × weight",
    },
    tpm: {
      kind: "counting",
      key: "tpm",
      stat: "fg3m",
      direction: "higher",
      label: "3PM",
      fullName: "Three-Pointers Made",
      description: "Three-point volume relative to the player pool.",
      formula: "(3PM − pool avg) ÷ pool std dev × weight",
    },
    tov: {
      kind: "counting",
      key: "tov",
      stat: "tov",
      direction: "lower",
      label: "TOV",
      fullName: "Turnovers",
      description: "Ball security. Fewer turnovers score higher — the sign is flipped.",
      formula: "(pool avg − TOV) ÷ pool std dev × weight",
    },
  },
  ratio: {
    fg: {
      kind: "ratio",
      key: "fg",
      numerator: "fgm",
      denominator: "fga",
      scale: 1,
      direction: "higher",
      label: "FG%",
      fullName: "Field Goal Impact",
      description:
        "Field-goal percentage weighted by attempt volume, so high-volume efficiency beats empty percentages.",
      formula: "FGA × (FG% − pool FG%), standardized × weight",
    },
    ft: {
      kind: "ratio",
      key: "ft",
      numerator: "ftm",
      denominator: "fta",
      scale: 1,
      direction: "higher",
      label: "FT%",
      fullName: "Free Throw Impact",
      description:
        "Free-throw percentage weighted by attempt volume, so high-volume efficiency beats empty percentages.",
      formula: "FTA × (FT% − pool FT%), standardized × weight",
    },
  },
  // Table column order. TOV sits with the counting stats; FG%/FT% close the
  // row like the Regular Stats table.
  categoryOrder: ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"],
  pools: [
    {
      key: "all",
      label: "All players",
      groups: "all",
      categories: ["pts", "reb", "ast", "stl", "blk", "tpm", "tov", "fg", "ft"],
      // Enough of the window played, at a rotation player's minutes load.
      // Replaces the NBA leader minimums used by the other tabs.
      minGamesShare: 0.3,
      minPlayingTimePerGame: 15,
      poolFloor: 150,
    },
  ],
  // A standard 12-team league with 13-man rosters.
  defaultLeague: { teams: 12, rosterSlots: 13 },
  points: {
    keys: ["pts", "reb", "ast", "stl", "blk", "fg3m", "tov"],
    // The PRD's example table; the Scoring controls override every entry.
    defaults: { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, fg3m: 0, tov: -1 },
  },
  positions: {
    groups: POSITION_GROUPS,
    parse: parsePosition,
    // v1 slot structure for a standard roster: roughly four guard slots, four
    // forward slots, and two center slots per team (PRD §6.7 — refined when
    // real platform slot structures land).
    replacementSlots: { G: 4, F: 4, C: 2 },
  },
  // Roster order: position slots, flex, utility, bench, injured list. The
  // defaults are a standard 13-man roster plus injured slots.
  slots: [
    {
      type: "PG",
      label: "PG",
      fullName: "Point Guard",
      kind: "starter",
      max: 4,
      defaultCount: 1,
      accepts: ["G"],
    },
    {
      type: "SG",
      label: "SG",
      fullName: "Shooting Guard",
      kind: "starter",
      max: 4,
      defaultCount: 1,
      accepts: ["G"],
    },
    {
      type: "SF",
      label: "SF",
      fullName: "Small Forward",
      kind: "starter",
      max: 4,
      defaultCount: 1,
      accepts: ["F"],
    },
    {
      type: "PF",
      label: "PF",
      fullName: "Power Forward",
      kind: "starter",
      max: 4,
      defaultCount: 1,
      accepts: ["F"],
    },
    {
      type: "C",
      label: "C",
      fullName: "Center",
      kind: "starter",
      max: 4,
      defaultCount: 1,
      accepts: ["C"],
    },
    {
      type: "G",
      label: "G",
      fullName: "Guard",
      kind: "starter",
      max: 4,
      defaultCount: 1,
      accepts: ["G"],
    },
    {
      type: "F",
      label: "F",
      fullName: "Forward",
      kind: "starter",
      max: 4,
      defaultCount: 1,
      accepts: ["F"],
    },
    {
      type: "UTIL",
      label: "UTIL",
      fullName: "Utility",
      kind: "starter",
      max: 6,
      defaultCount: 3,
      accepts: "any",
    },
    {
      type: "BENCH",
      label: "BE",
      fullName: "Bench",
      kind: "bench",
      max: 10,
      defaultCount: 3,
      accepts: "any",
    },
    {
      type: "IL",
      label: "IL",
      fullName: "Injured List",
      kind: "injured",
      max: 4,
      defaultCount: 1,
      accepts: "any",
    },
    {
      type: "ILPLUS",
      label: "IL+",
      fullName: "Injured List Plus",
      kind: "injured",
      max: 4,
      defaultCount: 1,
      accepts: "any",
    },
  ],
  methodCopy: {
    zscore: {
      whyItMatters:
        'Use this to answer "who is better?" in a category league. It puts a 25-point scorer and a shot-blocking center on one scale, so you can rank off a single number instead of squinting at seven stat columns.',
    },
    gscore: {
      whyItMatters:
        "Prefer this in weekly head-to-head. A player whose steals swing between 0 and 5 wins you that category some weeks and loses it others; G-Score trusts the steady producer more, and steady is what wins matchups.",
    },
    points: {
      description:
        "The stat line priced in points-league scoring: PTS ×1, REB ×1.2, AST ×1.5, STL ×3, BLK ×3, TOV ×−1. Ignores category weights.",
      formula: "pts×1 + reb×1.2 + ast×1.5 + stl×3 + blk×3 − tov×1",
    },
    positional: {
      description:
        "Z-Score surplus over the replacement player at the scarcest slot this player can fill (G/F/C parsed from position).",
      whyItMatters:
        "Same question, but position-aware. Good centers run out fast while guards are everywhere, so a center's edge over the next center counts for more. Use it when choosing between two similar players at different positions.",
    },
  },
};
