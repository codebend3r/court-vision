import {
  createLoader,
  createParser,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

export const PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_QUERY_LENGTH = 100;
// The deepest page a URL can ask for. Every list clamps to its own last page
// anyway; this only keeps an absurd number from reaching the ranker.
const MAX_PAGE = 100000;

export type PlayerSortKey =
  | "firstName"
  | "lastName"
  | "starredAt"
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
  | "fg3Pct"
  | "ftPct"
  | "tov";
export const PLAYER_SORT_KEYS: readonly PlayerSortKey[] = [
  "firstName",
  "lastName",
  "starredAt",
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
  "fg3Pct",
  "ftPct",
  "tov",
];
export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
export const DEFAULT_SORT_DIR: SortDirection = "desc";

export type PlayerGameRange = "all" | "last5" | "last10" | "last20" | "last40" | "last60";
export const PLAYER_GAME_RANGES: readonly PlayerGameRange[] = [
  "all",
  "last5",
  "last10",
  "last20",
  "last40",
  "last60",
];
export const DEFAULT_GAME_RANGE: PlayerGameRange = "all";
// The one wording every game-range picker and legend shows.
export const GAME_RANGE_LABELS: Record<PlayerGameRange, string> = {
  all: "All games",
  last5: "Last 5 games",
  last10: "Last 10 games",
  last20: "Last 20 games",
  last40: "Last 40 games",
  last60: "Last 60 games",
};

export const PLAYER_STAT_MODES = ["average", "total"] as const;
export type PlayerStatMode = (typeof PLAYER_STAT_MODES)[number];
export const DEFAULT_STAT_MODE: PlayerStatMode = "average";

// The four /players tabs. Starred lists only the signed-in user's watchlist
// (lib/watchlist), through the same table the regular tab uses.
export type PlayersTab = "regular" | "advanced" | "fantasy" | "starred";
export const PLAYERS_TABS: readonly PlayersTab[] = ["regular", "advanced", "fantasy", "starred"];
export const DEFAULT_TAB: PlayersTab = "regular";

export const isPlayersTab = (value: string | undefined): value is PlayersTab =>
  PLAYERS_TABS.some((tab) => tab === value);

// The 15 nullable per-game metrics Balldontlie's /v1/stats/advanced exposes,
// averaged on the fly from PlayerAdvancedGameLog (see lib/players/searchAdvanced.ts).
export type AdvancedMetricKey =
  | "pie"
  | "pace"
  | "assistPercentage"
  | "assistRatio"
  | "assistToTurnover"
  | "defensiveRating"
  | "defensiveReboundPercentage"
  | "effectiveFieldGoalPercentage"
  | "netRating"
  | "offensiveRating"
  | "offensiveReboundPercentage"
  | "reboundPercentage"
  | "trueShootingPercentage"
  | "turnoverRatio"
  | "usagePercentage";

export const ADVANCED_METRIC_KEYS: readonly AdvancedMetricKey[] = [
  "pie",
  "pace",
  "assistPercentage",
  "assistRatio",
  "assistToTurnover",
  "defensiveRating",
  "defensiveReboundPercentage",
  "effectiveFieldGoalPercentage",
  "netRating",
  "offensiveRating",
  "offensiveReboundPercentage",
  "reboundPercentage",
  "trueShootingPercentage",
  "turnoverRatio",
  "usagePercentage",
];

export type AdvancedSortKey = "firstName" | "lastName" | AdvancedMetricKey;
export const ADVANCED_SORT_KEYS: readonly AdvancedSortKey[] = [
  "firstName",
  "lastName",
  ...ADVANCED_METRIC_KEYS,
];

export const isAdvancedSortKey = (value: string | undefined): value is AdvancedSortKey =>
  ADVANCED_SORT_KEYS.some((key) => key === value);

export const isAdvancedMetricKey = (
  key: PlayerSortKey | AdvancedSortKey,
): key is AdvancedMetricKey => ADVANCED_METRIC_KEYS.some((metricKey) => metricKey === key);

const isPlayerSortKey = (value: string | undefined): value is PlayerSortKey =>
  PLAYER_SORT_KEYS.some((key) => key === value);

// Each tab's landing sort. The regular (and fantasy) view leads with points,
// highest first, so the leaderboard shows on arrival without query params;
// advanced leads with PIE, its single-number estimate; starred leads with the
// most recently starred player, ordered by the act of starring, not production.
const DEFAULT_SORT_BY_TAB = {
  regular: "pts",
  advanced: "pie",
  fantasy: "pts",
  starred: "starredAt",
} as const satisfies Record<PlayersTab, PlayerSortKey | AdvancedSortKey>;

export const defaultSortFor = <Tab extends PlayersTab>({
  tab,
}: {
  tab: Tab;
}): (typeof DEFAULT_SORT_BY_TAB)[Tab] => DEFAULT_SORT_BY_TAB[tab];

export const isPlayerGameRange = (value: string | undefined): value is PlayerGameRange =>
  PLAYER_GAME_RANGES.some((range) => range === value);

// The window a lastN range covers, in games; the whole season has no cap.
export const gamesForRange = ({ range }: { range: PlayerGameRange }): number | null =>
  range === "all" ? null : Number.parseInt(range.replace("last", ""), 10);

export const isPlayerStatMode = (value: string | undefined): value is PlayerStatMode =>
  PLAYER_STAT_MODES.some((mode) => mode === value);

// A whole number clamped to [min, max]; anything else reads as absent, so the
// parser's default applies.
export const parseAsClampedInt = ({ min, max }: { min: number; max: number }) =>
  createParser({
    parse: (value: string) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isSafeInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : null;
    },
    serialize: (value: number) => String(value),
  });

// Trimmed and capped, so a pasted essay or stray whitespace never reaches a
// name match.
const parseAsQuery = createParser({
  parse: (value: string) => value.trim().slice(0, MAX_QUERY_LENGTH),
  serialize: (value: string) => value,
});

const parseAsPageSize = createParser({
  parse: (value: string) => {
    const size = Number.parseInt(value, 10);
    return PAGE_SIZES.includes(size) ? size : null;
  },
  serialize: (value: number) => String(value),
});

// NBA qualifying minimums apply by default; only an explicit 0 disables them.
const parseAsMinimums = createParser({
  parse: (value: string) => value !== "0",
  serialize: (value: boolean) => (value ? "1" : "0"),
});

// The keys every players list reads the same way, whichever screen owns the
// rest of the URL: the server-rendered tabs here, and the Fantasy tab's
// client-side nuqs state (lib/valuation/searchParams.ts).
export const listParsers = {
  q: parseAsQuery.withDefault(""),
  page: parseAsClampedInt({ min: 1, max: MAX_PAGE }).withDefault(1),
  size: parseAsPageSize.withDefault(DEFAULT_PAGE_SIZE),
  dir: parseAsStringLiteral(SORT_DIRECTIONS).withDefault(DEFAULT_SORT_DIR),
  range: parseAsStringLiteral(PLAYER_GAME_RANGES).withDefault(DEFAULT_GAME_RANGE),
  mode: parseAsStringLiteral(PLAYER_STAT_MODES).withDefault(DEFAULT_STAT_MODE),
};

type PlayersListParams = inferParserType<typeof listParsers> & { minimums: boolean };

// The params are a union on `tab`, so each table's ranker gets the sort keys
// its own columns offer and never has to coerce the other tab's.
export type RegularSearchParams = PlayersListParams & {
  tab: Exclude<PlayersTab, "advanced">;
  sort: PlayerSortKey;
};
export type AdvancedSearchParams = PlayersListParams & {
  tab: "advanced";
  sort: AdvancedSortKey;
};
export type PlayersSearchParams = RegularSearchParams | AdvancedSearchParams;

// What an href serializes. Any tab may pair with any sort key here: a link is
// only text, and parsing validates the pair again on the way back in.
export type PlayersHrefParams = PlayersListParams & {
  tab: PlayersTab;
  sort: PlayerSortKey | AdvancedSortKey;
};

// A route's `searchParams`, as Next hands them to a page.
export type RawSearchParams = Record<string, string | string[] | undefined>;

const loadListParams = createLoader({
  ...listParsers,
  minimums: parseAsMinimums.withDefault(true),
});

// `sort` loads as plain text: which keys it may hold depends on the tab.
const loadTabParams = createLoader({
  tab: parseAsStringLiteral(PLAYERS_TABS).withDefault(DEFAULT_TAB),
  sort: parseAsString,
});

// The sort, validated against the tab's own key set, else the tab's default.
const regularTabSort = ({
  tab,
  sort,
}: {
  tab: RegularSearchParams["tab"];
  sort: string | undefined;
}): Pick<RegularSearchParams, "tab" | "sort"> => ({
  tab,
  sort: isPlayerSortKey(sort) ? sort : defaultSortFor({ tab }),
});

const tabSortFor = ({
  tab,
  sort,
}: {
  tab: PlayersTab;
  sort: string | undefined;
}): Pick<RegularSearchParams, "tab" | "sort"> | Pick<AdvancedSearchParams, "tab" | "sort"> =>
  tab === "advanced"
    ? { tab, sort: isAdvancedSortKey(sort) ? sort : defaultSortFor({ tab }) }
    : regularTabSort({ tab, sort });

export const parsePlayersSearchParams = ({
  raw,
}: {
  raw: RawSearchParams;
}): PlayersSearchParams => {
  const { tab, sort } = loadTabParams(raw);
  return { ...loadListParams(raw), ...tabSortFor({ tab, sort: sort ?? undefined }) };
};

// /watchlist is the starred view whatever the query's `tab` says.
export const parseStarredSearchParams = ({
  raw,
}: {
  raw: RawSearchParams;
}): RegularSearchParams => ({
  ...loadListParams(raw),
  ...regularTabSort({ tab: "starred", sort: loadTabParams(raw).sort ?? undefined }),
});

// Defaults stay out of the URL, in a fixed key order, so every view has one
// canonical href.
export const buildPlayersHref = (args: PlayersHrefParams): string => {
  const entries: Array<[string, string] | false> = [
    args.q !== "" && ["q", args.q],
    args.page > 1 && ["page", String(args.page)],
    args.size !== DEFAULT_PAGE_SIZE && ["size", String(args.size)],
    args.tab !== DEFAULT_TAB && ["tab", args.tab],
    args.sort !== defaultSortFor({ tab: args.tab }) && ["sort", args.sort],
    args.dir !== DEFAULT_SORT_DIR && ["dir", args.dir],
    args.range !== DEFAULT_GAME_RANGE && ["range", args.range],
    args.mode !== DEFAULT_STAT_MODE && ["mode", args.mode],
    !args.minimums && ["minimums", "0"],
  ];
  const query = new URLSearchParams(
    entries.filter((entry): entry is [string, string] => entry !== false),
  ).toString();
  return query === "" ? "/players" : `/players?${query}`;
};
