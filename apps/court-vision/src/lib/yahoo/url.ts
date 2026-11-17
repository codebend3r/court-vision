import { YAHOO_LEAGUE_HOST } from "@/lib/yahoo/constants";
import { type YahooFailure } from "@/lib/yahoo/types";

export type YahooUrlParse =
  | { status: "ok"; leagueId: string }
  | { status: "past_season"; season: number }
  | { status: "wrong_sport" }
  | { status: "invalid" };

const LEAGUE_ID = /^\d{1,9}$/;
const YEAR = /^\d{4}$/;
const YAHOO_SPORTS_SUFFIX = ".fantasysports.yahoo.com";
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

const INVALID: YahooUrlParse = { status: "invalid" };

type ParseSegmentsProps = { segments: string[] };

const parseSegments = ({ segments }: ParseSegmentsProps): YahooUrlParse => {
  const [first, second, third, fourth] = segments;
  if (first === "nba") {
    return LEAGUE_ID.test(second ?? "") ? { status: "ok", leagueId: second ?? "" } : INVALID;
  }
  if (YEAR.test(first ?? "") && second === "nba" && LEAGUE_ID.test(third ?? "")) {
    return { status: "past_season", season: Number(first) };
  }
  if (
    first === "archive" &&
    second === "nba" &&
    YEAR.test(third ?? "") &&
    LEAGUE_ID.test(fourth ?? "")
  ) {
    return { status: "past_season", season: Number(third) };
  }
  return INVALID;
};

type ParseYahooLeagueUrlProps = { input: string };

export const parseYahooLeagueUrl = ({ input }: ParseYahooLeagueUrlProps): YahooUrlParse => {
  const trimmed = input.trim();
  if (LEAGUE_ID.test(trimmed)) {
    return { status: "ok", leagueId: trimmed };
  }
  if (trimmed === "") {
    return INVALID;
  }
  const url = URL.parse(SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (!url) {
    return INVALID;
  }
  const host = url.hostname.toLowerCase();
  if (host === YAHOO_LEAGUE_HOST) {
    return parseSegments({ segments: url.pathname.split("/").filter((segment) => segment !== "") });
  }
  return host.endsWith(YAHOO_SPORTS_SUFFIX) ? { status: "wrong_sport" } : INVALID;
};

export type YahooLeagueIdResult =
  | { status: "ok"; leagueId: string }
  | Extract<YahooFailure, { status: "invalid_url" | "wrong_sport" | "past_season" }>;

// The league id a pasted URL names, or the import failure that explains why
// it names none. Every importer path answers a bad URL with these statuses.
type ParseYahooLeagueIdProps = { input: string };

export const parseYahooLeagueId = ({ input }: ParseYahooLeagueIdProps): YahooLeagueIdResult => {
  const parsed = parseYahooLeagueUrl({ input });
  if (parsed.status === "ok") return parsed;
  if (parsed.status === "invalid") return { status: "invalid_url" };
  return { status: parsed.status };
};
