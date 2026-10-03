import { type TeamGameResult } from "@/lib/teams/stats";

export type WinsRow = { game: number } & Partial<Record<string, number>>;

// Rows for a standings block's cumulative-wins chart: row N holds each
// team's win total after its Nth game (teams that haven't played N games
// are absent from row N, so their line simply stops).
export const buildCumulativeWins = ({
  results,
  abbrs,
}: {
  results: readonly TeamGameResult[];
  abbrs: readonly string[];
}): WinsRow[] => {
  const included = new Set(abbrs);
  const byTeam = results.reduce<Map<string, number[]>>((acc, entry) => {
    if (!included.has(entry.teamAbbr)) return acc;
    const wins = acc.get(entry.teamAbbr) ?? [];
    const previous = wins[wins.length - 1] ?? 0;
    return new Map(acc).set(entry.teamAbbr, [...wins, previous + (entry.winLoss === "W" ? 1 : 0)]);
  }, new Map());
  const maxGames = [...byTeam.values()].reduce((max, wins) => Math.max(max, wins.length), 0);
  return Array.from({ length: maxGames }, (_, index) => ({
    game: index + 1,
    ...[...byTeam.entries()].reduce<Partial<Record<string, number>>>(
      (row, [abbr, wins]) => (wins[index] === undefined ? row : { ...row, [abbr]: wins[index] }),
      {},
    ),
  }));
};
