export const PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_QUERY_LENGTH = 100;

export type PlayerSortKey =
  | "firstName"
  | "lastName"
  | "gamesPlayed"
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "fgm"
  | "fga"
  | "fg3m"
  | "fg3a"
  | "fgPct"
  | "ftPct"
  | "tov";
export const PLAYER_SORT_KEYS: readonly PlayerSortKey[] = [
  "firstName",
  "lastName",
  "gamesPlayed",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "fgPct",
  "ftPct",
  "tov",
];
export type SortDirection = "asc" | "desc";
export type PlayerGameRange = "all" | "last5" | "last10" | "last20" | "last40" | "last60";
export const PLAYER_GAME_RANGES: readonly PlayerGameRange[] = [
  "all",
  "last5",
  "last10",
  "last20",
  "last40",
  "last60",
];
export type PlayerStatMode = "average" | "total";
// The landing view sorts by points, highest first, so the leaderboard shows
// on arrival without query params.
export const DEFAULT_SORT_KEY: PlayerSortKey = "pts";
export const DEFAULT_SORT_DIR: SortDirection = "desc";

export type PlayersSearchParams = {
  q: string;
  page: number;
  size: number;
  sort: PlayerSortKey;
  dir: SortDirection;
  range: PlayerGameRange;
  mode: PlayerStatMode;
  minimums: boolean;
};

const isPlayerSortKey = (value: string | undefined): value is PlayerSortKey =>
  PLAYER_SORT_KEYS.some((key) => key === value);

export const isPlayerGameRange = (value: string | undefined): value is PlayerGameRange =>
  PLAYER_GAME_RANGES.some((range) => range === value);

export const isPlayerStatMode = (value: string | undefined): value is PlayerStatMode =>
  value === "average" || value === "total";

export const parsePlayersSearchParams = (raw: {
  q?: string;
  page?: string;
  size?: string;
  sort?: string;
  dir?: string;
  range?: string;
  mode?: string;
  minimums?: string;
}): PlayersSearchParams => {
  const q = (raw.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const parsedPage = Number.parseInt(raw.page ?? "", 10);
  const page = !Number.isSafeInteger(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const parsedSize = Number.parseInt(raw.size ?? "", 10);
  const size = PAGE_SIZES.includes(parsedSize) ? parsedSize : DEFAULT_PAGE_SIZE;
  const sort = isPlayerSortKey(raw.sort) ? raw.sort : DEFAULT_SORT_KEY;
  const dir: SortDirection = raw.dir === "asc" ? "asc" : DEFAULT_SORT_DIR;
  const range: PlayerGameRange = isPlayerGameRange(raw.range) ? raw.range : "all";
  const mode: PlayerStatMode = isPlayerStatMode(raw.mode) ? raw.mode : "average";
  // NBA qualifying minimums apply by default; only an explicit 0 disables them.
  const minimums = raw.minimums !== "0";
  return { q, page, size, sort, dir, range, mode, minimums };
};

export const buildPlayersHref = (args: PlayersSearchParams): string => {
  const params = new URLSearchParams();
  if (args.q !== "") {
    params.set("q", args.q);
  }
  if (args.page > 1) {
    params.set("page", String(args.page));
  }
  if (args.size !== DEFAULT_PAGE_SIZE) {
    params.set("size", String(args.size));
  }
  if (args.sort !== DEFAULT_SORT_KEY) {
    params.set("sort", args.sort);
  }
  if (args.dir !== DEFAULT_SORT_DIR) {
    params.set("dir", args.dir);
  }
  if (args.range !== "all") {
    params.set("range", args.range);
  }
  if (args.mode !== "average") {
    params.set("mode", args.mode);
  }
  if (!args.minimums) {
    params.set("minimums", "0");
  }
  const query = params.toString();
  return query === "" ? "/players" : `/players?${query}`;
};
