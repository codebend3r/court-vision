import { type AdvisorLeagueData } from "@/lib/advisor/types";
import { type PlayerGameRange } from "@/lib/players/searchParams";
import { type FantasyStatLine } from "@/lib/valuation/types";

// Recent form is the last ten games, set against the whole season.
export const TREND_RANGE: PlayerGameRange = "last10";
export const TRENDING_LIMIT = 10;
// Fewer recent games than this is too thin to call a trend.
export const MIN_TREND_GAMES = 5;

// The season and recent lines of the league's free players only: the page
// filters both before they cross to the client.
export type TrendLines = { season: FantasyStatLine[]; recent: FantasyStatLine[] };

export type TrendingRow = {
  playerId: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  owner: "free_agent" | "waivers";
  injuryStatus: string | null;
  seasonScore: number;
  recentScore: number;
  change: number;
  recentGames: number;
};

/**
 * Players nobody in the league rosters who are still on an NBA roster: the
 * free agents and waiver players the trend list may show. Mine count as
 * rostered even when the league's list left my IL players out.
 */
type FreePlayerIdsProps = {
  league: Pick<AdvisorLeagueData, "rosteredPlayerIds" | "myRoster">;
  activePlayerIds: readonly number[];
};

export const freePlayerIds = ({ league, activePlayerIds }: FreePlayerIdsProps): Set<number> => {
  const rostered = new Set([
    ...league.rosteredPlayerIds,
    ...league.myRoster.map(({ playerId }) => playerId),
  ]);
  return new Set(activePlayerIds.filter((playerId) => !rostered.has(playerId)));
};

/**
 * The free players trending up most: each one's recent line and season line
 * scored on the same yardstick (`scoreLine`, the league's method summed over
 * its categories), ranked by how far recent form runs above the season, top
 * ten. Only rising players with enough recent games make the list.
 */
type ScoreLineProps = { line: FantasyStatLine };

type BuildTrendingProps = {
  lines: TrendLines;
  freeIds: ReadonlySet<number>;
  waivers: AdvisorLeagueData["waivers"];
  scoreLine: ({ line }: ScoreLineProps) => number;
};

export const buildTrending = ({
  lines,
  freeIds,
  waivers,
  scoreLine,
}: BuildTrendingProps): TrendingRow[] => {
  const seasonById = new Map(lines.season.map((line) => [line.playerId, line]));
  const waiverById = new Map(waivers.map((waiver) => [waiver.playerId, waiver]));
  return lines.recent
    .flatMap((recent): TrendingRow[] => {
      const season = seasonById.get(recent.playerId);
      if (
        season === undefined ||
        !freeIds.has(recent.playerId) ||
        recent.gamesPlayed < MIN_TREND_GAMES
      ) {
        return [];
      }
      const seasonScore = scoreLine({ line: season });
      const recentScore = scoreLine({ line: recent });
      const waiver = waiverById.get(recent.playerId);
      return [
        {
          playerId: recent.playerId,
          fullName: recent.fullName,
          teamAbbr: recent.teamAbbr,
          position: recent.position,
          owner: waiver === undefined ? "free_agent" : "waivers",
          injuryStatus: waiver?.injuryStatus ?? null,
          seasonScore,
          recentScore,
          change: recentScore - seasonScore,
          recentGames: recent.gamesPlayed,
        },
      ];
    })
    .filter(({ change }) => change > 0)
    .toSorted((a, b) => b.change - a.change || a.playerId - b.playerId)
    .slice(0, TRENDING_LIMIT);
};
