import { type FantasyPlayerValues, type MethodValueKey } from "@vision/core/valuation/types";
import { type Category } from "@vision/sport-basketball/types";

import { type BreakdownFor, buildNeeds, healthyPlayers, pickWeakNeeds } from "@/lib/advisor/needs";
import { pickDrop, pickFreeAgents } from "@/lib/advisor/pickups";
import { findTargets } from "@/lib/advisor/target";
import { buildTradeOffers } from "@/lib/advisor/trades";
import {
  type Advice,
  type AdvisorLeagueData,
  type AdvisorFocus,
  type AdvisorOwner,
  type AdvisorPlayer,
} from "@/lib/advisor/types";
import { type FantasyStatLine } from "@/lib/valuation/types";
import { buildWaiverModel } from "@/lib/waiverWire/model";
import { type ScoreKey } from "@/lib/waiverWire/swapBoard";

type BuildAdviceProps = {
  lines: readonly FantasyStatLine[];
  values: readonly FantasyPlayerValues[];
  valueKey: MethodValueKey;
  league: AdvisorLeagueData;
  activePlayerIds: ReadonlySet<number>;
  breakdownFor: BreakdownFor;
  scoreKey: ScoreKey;
  // The URL's focus (a category key, or anything else for all weak ones) and
  // the best fit the trades are for (null for the first).
  focus: string | null;
  targetId: number | null;
};

/**
 * The Roster Advisor's whole answer: every category weakest first, the weak
 * ones worth fixing, and for the focus (all of them together, or one) up to
 * five best fits (and, apart, the five best on other teams), three rows of
 * trades for the chosen fit when they are on another team, two to five free
 * agents, and who to drop for one.
 * Null when there is nothing to rank (no team of mine, no valued players).
 */
export const buildAdvice = ({
  lines,
  values,
  valueKey,
  league,
  activePlayerIds,
  breakdownFor,
  scoreKey,
  focus,
  targetId,
}: BuildAdviceProps): Advice | null => {
  const needs = buildNeeds({ teams: league.teams, breakdownFor, scoreKey });
  const weakNeeds = pickWeakNeeds({ needs });
  const [weakness] = weakNeeds;
  if (weakness === undefined) return null;
  // One category the URL names, or every weak one together.
  const focused = needs.find((need) => need.key === focus);
  const focusNeeds = focused === undefined ? weakNeeds : [focused];
  const focusKey: AdvisorFocus = focused?.key ?? "all";

  const lineById = new Map(lines.map((line) => [line.playerId, line]));
  const valueById = new Map(values.map((entry) => [entry.playerId, entry[valueKey]]));
  type ScoreInProps = { playerId: number; key: Category };

  const scoreIn = ({ playerId, key }: ScoreInProps): number =>
    breakdownFor({ playerId }).find((entry) => entry.key === key)?.[scoreKey] ?? 0;
  type FocusScoresOfProps = { playerId: number };

  const focusScoresOf = ({ playerId }: FocusScoresOfProps) =>
    focusNeeds.map(({ key, label }) => ({ key, label, score: scoreIn({ playerId, key }) }));

  type ToPlayerProps = { playerId: number; owner: AdvisorOwner; injuryStatus: string | null };

  const toPlayer = ({ playerId, owner, injuryStatus }: ToPlayerProps): AdvisorPlayer[] => {
    const line = lineById.get(playerId);
    const value = valueById.get(playerId);
    return line === undefined || value === undefined
      ? []
      : [
          {
            playerId,
            fullName: line.fullName,
            teamAbbr: line.teamAbbr,
            position: line.position,
            injuryStatus,
            value,
            categoryScore: focusScoresOf({ playerId }).reduce((sum, { score }) => sum + score, 0),
            focusScores: focusScoresOf({ playerId }),
            owner,
          },
        ];
  };

  // The Waiver Wire's own slicing, so the free pool and my healthy roster
  // match that page exactly.
  const model = buildWaiverModel({
    lines,
    values,
    valueKey,
    league,
    activePlayerIds,
    pos: "all",
  });
  const myRoster = model.roster.flatMap((row) =>
    toPlayer({ playerId: row.playerId, owner: { kind: "mine" }, injuryStatus: row.injuryStatus }),
  );
  const freePool = model.freePool.flatMap((row) =>
    toPlayer({
      playerId: row.playerId,
      owner: { kind: row.owner === "waivers" ? "waivers" : "free_agent" },
      injuryStatus: row.injuryStatus,
    }),
  );
  const elsewhere = league.teams
    .filter((team) => !team.isMine)
    .flatMap((team) =>
      healthyPlayers({ team }).flatMap(({ playerId, injuryStatus }) =>
        toPlayer({
          playerId,
          owner: {
            kind: "team",
            teamId: team.teamId,
            teamName: team.name,
            managerName: team.managerName,
          },
          injuryStatus,
        }),
      ),
    );

  const targets = findTargets({ candidates: [...elsewhere, ...freePool], myRoster });
  const target = targets.find((player) => player.playerId === targetId) ?? targets[0] ?? null;
  const drop = pickDrop({ myRoster });
  return {
    needs,
    weakNeeds,
    weakness,
    focus: focusKey,
    focusNeeds,
    focusLabel: focusNeeds.map(({ label }) => label).join(" + "),
    targets,
    tradeTargets: findTargets({ candidates: elsewhere, myRoster }),
    target,
    trades: target?.owner.kind === "team" ? buildTradeOffers({ target, myRoster }) : [],
    freeAgents: pickFreeAgents({ freePool, drop }),
    drop,
  };
};
