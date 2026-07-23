import {
  type Basis,
  type Category,
  type CountingCategory,
  type FantasyStatLine,
} from "@/lib/valuation/types";

export type CategoryKind = "counting" | "ratio";

export type CategoryMeta = {
  key: Category;
  label: string;
  fullName: string;
  description: string;
  formula: string;
  kind: CategoryKind;
};

// Table column order. TOV sits with the counting stats; FG%/FT% close the row
// like the existing Regular Stats table.
export const CATEGORY_META: readonly CategoryMeta[] = [
  {
    key: "pts",
    label: "PTS",
    fullName: "Points",
    description: "Scoring contribution relative to the player pool.",
    formula: "(PTS − pool avg) ÷ pool std dev × weight",
    kind: "counting",
  },
  {
    key: "reb",
    label: "REB",
    fullName: "Rebounds",
    description: "Rebounding contribution relative to the player pool.",
    formula: "(REB − pool avg) ÷ pool std dev × weight",
    kind: "counting",
  },
  {
    key: "ast",
    label: "AST",
    fullName: "Assists",
    description: "Playmaking contribution relative to the player pool.",
    formula: "(AST − pool avg) ÷ pool std dev × weight",
    kind: "counting",
  },
  {
    key: "stl",
    label: "STL",
    fullName: "Steals",
    description: "Steals contribution relative to the player pool.",
    formula: "(STL − pool avg) ÷ pool std dev × weight",
    kind: "counting",
  },
  {
    key: "blk",
    label: "BLK",
    fullName: "Blocks",
    description: "Shot-blocking contribution relative to the player pool.",
    formula: "(BLK − pool avg) ÷ pool std dev × weight",
    kind: "counting",
  },
  {
    key: "tpm",
    label: "3PM",
    fullName: "Three-Pointers Made",
    description: "Three-point volume relative to the player pool.",
    formula: "(3PM − pool avg) ÷ pool std dev × weight",
    kind: "counting",
  },
  {
    key: "tov",
    label: "TOV",
    fullName: "Turnovers",
    description: "Ball security. Fewer turnovers score higher — the sign is flipped.",
    formula: "(pool avg − TOV) ÷ pool std dev × weight",
    kind: "counting",
  },
  {
    key: "fg",
    label: "FG%",
    fullName: "Field Goal Impact",
    description:
      "Field-goal percentage weighted by attempt volume, so high-volume efficiency beats empty percentages.",
    formula: "FGA × (FG% − pool FG%), standardized × weight",
    kind: "ratio",
  },
  {
    key: "ft",
    label: "FT%",
    fullName: "Free Throw Impact",
    description:
      "Free-throw percentage weighted by attempt volume, so high-volume efficiency beats empty percentages.",
    formula: "FTA × (FT% − pool FT%), standardized × weight",
    kind: "ratio",
  },
];

export const CATEGORY_KEYS: readonly Category[] = CATEGORY_META.map((meta) => meta.key);

export const isCategory = (value: string): value is Category =>
  CATEGORY_KEYS.some((key) => key === value);

export const COUNTING_STAT_KEY: Record<
  CountingCategory,
  "pts" | "reb" | "ast" | "stl" | "blk" | "fg3m" | "tov"
> = {
  pts: "pts",
  reb: "reb",
  ast: "ast",
  stl: "stl",
  blk: "blk",
  tpm: "fg3m",
  tov: "tov",
};

export const isCountingCategory = (category: Category): category is CountingCategory =>
  category !== "fg" && category !== "ft";

const perBasis = ({
  total,
  gamesPlayed,
  basis,
}: {
  total: number;
  gamesPlayed: number;
  basis: Basis;
}): number => {
  if (basis === "total") return total;
  return gamesPlayed > 0 ? total / gamesPlayed : 0;
};

// The single per-category primitive: counting totals (TOV negated so every
// downstream number reads higher-is-better) and volume-weighted ratio impacts
// (PRD §5.3). Zero attempts are neutral, never a divide by zero.
export const categoryValue = ({
  line,
  category,
  basis,
  leagueFgPct,
  leagueFtPct,
}: {
  line: FantasyStatLine;
  category: Category;
  basis: Basis;
  leagueFgPct: number;
  leagueFtPct: number;
}): number => {
  if (isCountingCategory(category)) {
    const total = line[COUNTING_STAT_KEY[category]];
    const signed = category === "tov" ? -total : total;
    return perBasis({ total: signed, gamesPlayed: line.gamesPlayed, basis });
  }
  const made = category === "fg" ? line.fgm : line.ftm;
  const attempted = category === "fg" ? line.fga : line.fta;
  if (attempted === 0) return 0;
  const leaguePct = category === "fg" ? leagueFgPct : leagueFtPct;
  const impact = attempted * (made / attempted - leaguePct);
  return perBasis({ total: impact, gamesPlayed: line.gamesPlayed, basis });
};
