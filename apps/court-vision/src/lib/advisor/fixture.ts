import { type Category, type FantasyCategoryBreakdown } from "@vision/sport-basketball/types";

import { type BreakdownFor } from "@/lib/advisor/needs";
import { type AdvisorOwner, type AdvisorPlayer } from "@/lib/advisor/types";

type ScoreLine = Partial<Record<Category, number>>;

const LABELS: Partial<Record<Category, string>> = { pts: "PTS", reb: "REB", ast: "AST" };

/** A breakdown lookup over per-category z scores; g mirrors z. */
type FakeBreakdownForProps = { scores: ReadonlyMap<number, ScoreLine> };

export const fakeBreakdownFor =
  ({ scores }: FakeBreakdownForProps): BreakdownFor =>
  ({ playerId }) =>
    Object.entries(scores.get(playerId) ?? {}).flatMap(([key, z]): FantasyCategoryBreakdown[] =>
      key === "pts" || key === "reb" || key === "ast"
        ? [{ key, label: LABELS[key] ?? key, fullName: key, kind: "counting", perGame: 0, z, g: z }]
        : [],
    );

type PlayerProps = {
  playerId: number;
  value: number;
  categoryScore?: number;
  owner?: AdvisorOwner;
};

export const player = ({
  playerId,
  value,
  categoryScore = 0,
  owner = { kind: "mine" },
}: PlayerProps): AdvisorPlayer => ({
  playerId,
  fullName: `Player ${playerId}`,
  teamAbbr: null,
  position: null,
  injuryStatus: null,
  value,
  categoryScore,
  owner,
});
