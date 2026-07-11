import { z } from "zod";

// PRIMARY source per the plan (docs/superpowers/plans/2026-07-11-player-headshots.md)
// is `https://cdn.nba.com/static/json/staticData/playerindex_00.json`. Probed at
// implementation time: it returns a 403 "Access Denied" from Akamai even with a
// browser User-Agent + Referer, while cdn.nba.com itself is reachable (headshot
// images 200). So this module uses the FALLBACK: nba_api's static `data.py`,
// which exposes a flat `players = [[id, lastName, firstName, fullName, isActive],
// ...]` block we parse with a regex.
export const NBA_DATA_PY_URL =
  "https://raw.githubusercontent.com/swar/nba_api/master/src/nba_api/stats/library/data.py";

// Below this, treat the parse as broken (wrong shape, truncated fetch, etc.)
// rather than silently mapping a handful of players.
const MIN_EXPECTED_ROWS = 4000;

export interface NbaPlayerIndexRow {
  personId: number;
  fullName: string;
}

const nbaPlayerIndexRowSchema: z.ZodType<NbaPlayerIndexRow> = z.object({
  personId: z.number(),
  fullName: z.string(),
});

// Isolates the top-level `players = [ ... ]` block so sibling blocks further
// down the file (`wnba_players`, `teams`) are never parsed.
const PLAYERS_BLOCK_PATTERN = /players = \[([\s\S]*?)\n\]/;

// Matches one `[id, "lastName", "firstName", "fullName", True|False]` row,
// capturing the id (group 1) and full name (group 2). `(?:[^"\\]|\\.)*` allows
// for an escaped character inside a quoted field without ending the match early.
const PLAYER_ROW_PATTERN =
  /\[\s*(\d+)\s*,\s*"(?:[^"\\]|\\.)*"\s*,\s*"(?:[^"\\]|\\.)*"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*(?:True|False)\s*\]/g;

export const parseNbaPlayerIndex = (source: string): NbaPlayerIndexRow[] => {
  const block = PLAYERS_BLOCK_PATTERN.exec(source)?.[1] ?? "";
  const rows = Array.from(block.matchAll(PLAYER_ROW_PATTERN)).map((match) =>
    nbaPlayerIndexRowSchema.parse({
      personId: Number(match[1]),
      fullName: match[2],
    }),
  );
  if (rows.length <= MIN_EXPECTED_ROWS) {
    throw new Error(
      `NBA player index parse produced ${rows.length} rows, expected more than ${MIN_EXPECTED_ROWS}`,
    );
  }
  return rows;
};

export const fetchNbaPlayerIndex = async ({
  fetchImpl = globalThis.fetch,
}: { fetchImpl?: typeof fetch } = {}): Promise<NbaPlayerIndexRow[]> => {
  const response = await fetchImpl(NBA_DATA_PY_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch NBA player index (${response.status})`);
  }
  const source = await response.text();
  return parseNbaPlayerIndex(source);
};
