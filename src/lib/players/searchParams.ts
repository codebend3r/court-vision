export const PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_QUERY_LENGTH = 100;

export const PLAYER_SORT_KEYS = ["firstName", "lastName"] as const;
export type PlayerSortKey = (typeof PLAYER_SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";
export const DEFAULT_SORT_KEY: PlayerSortKey = "firstName";
export const DEFAULT_SORT_DIR: SortDirection = "asc";

export interface PlayersSearchParams {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
  sort: PlayerSortKey;
  dir: SortDirection;
}

const isPlayerSortKey = (value: string | undefined): value is PlayerSortKey =>
  PLAYER_SORT_KEYS.some((key) => key === value);

export const parsePlayersSearchParams = (raw: {
  q?: string;
  page?: string;
  size?: string;
  retired?: string;
  sort?: string;
  dir?: string;
}): PlayersSearchParams => {
  const q = (raw.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const parsedPage = Number.parseInt(raw.page ?? "", 10);
  const page = !Number.isSafeInteger(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const parsedSize = Number.parseInt(raw.size ?? "", 10);
  const size = PAGE_SIZES.includes(parsedSize) ? parsedSize : DEFAULT_PAGE_SIZE;
  const sort = isPlayerSortKey(raw.sort) ? raw.sort : DEFAULT_SORT_KEY;
  const dir: SortDirection = raw.dir === "desc" ? "desc" : DEFAULT_SORT_DIR;
  return { q, page, size, includeRetired: raw.retired === "1", sort, dir };
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
  if (args.includeRetired) {
    params.set("retired", "1");
  }
  if (args.sort !== DEFAULT_SORT_KEY) {
    params.set("sort", args.sort);
  }
  if (args.dir !== DEFAULT_SORT_DIR) {
    params.set("dir", args.dir);
  }
  const query = params.toString();
  return query === "" ? "/players" : `/players?${query}`;
};
