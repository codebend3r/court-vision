// The quick filter over who holds a player in the active league: everyone, only
// players on some manager's roster, or only free agents.
export const PLAYER_OWNER_FILTERS = ["all", "taken", "free"] as const;
export type PlayerOwnerFilter = (typeof PLAYER_OWNER_FILTERS)[number];

export const DEFAULT_OWNER_FILTER: PlayerOwnerFilter = "all";

export const OWNER_FILTER_LABELS: Record<PlayerOwnerFilter, string> = {
  all: "All players",
  taken: "Taken",
  free: "Free agents",
};

// Keeps the rows the filter allows. `takenIds` null means the league's rosters
// are unknown (no league, or a hand-built one), so nobody can be called taken
// or free and every row stays.
export const filterByOwner = <Row>({
  rows,
  owner,
  takenIds,
  idOf,
}: {
  rows: readonly Row[];
  owner: PlayerOwnerFilter;
  takenIds: ReadonlySet<number> | null;
  idOf: (row: Row) => number;
}): readonly Row[] => {
  if (owner === "all" || takenIds === null) return rows;
  return rows.filter((row) => takenIds.has(idOf(row)) === (owner === "taken"));
};
