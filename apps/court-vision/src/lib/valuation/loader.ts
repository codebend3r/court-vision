import { unstable_cache } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { gamesForRange, type PlayerGameRange } from "@/lib/players/searchParams";
import { latestSeason } from "@/lib/valuation/season";
import { type FantasyStatLine } from "@/lib/valuation/types";

// One aggregated stat line per player, flat: totals, second moments (`sq*`
// sums of squares, `cross*` made-attempt products) and identity. Integer
// sums are cast to int4 in SQL so they arrive as plain numbers.
const windowLineSchema = z.object({
  playerId: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  teamAbbr: z.string().nullable(),
  position: z.string().nullable(),
  nbaPersonId: z.number().nullable(),
  gamesPlayed: z.number(),
  minutes: z.number(),
  pts: z.number(),
  reb: z.number(),
  ast: z.number(),
  stl: z.number(),
  blk: z.number(),
  fg3m: z.number(),
  tov: z.number(),
  fgm: z.number(),
  fga: z.number(),
  ftm: z.number(),
  fta: z.number(),
  sqPts: z.number(),
  sqReb: z.number(),
  sqAst: z.number(),
  sqStl: z.number(),
  sqBlk: z.number(),
  sqFg3m: z.number(),
  sqTov: z.number(),
  sqFgm: z.number(),
  sqFga: z.number(),
  sqFtm: z.number(),
  sqFta: z.number(),
  crossFg: z.number(),
  crossFt: z.number(),
});

const toStatLine = ({
  sqPts,
  sqReb,
  sqAst,
  sqStl,
  sqBlk,
  sqFg3m,
  sqTov,
  sqFgm,
  sqFga,
  sqFtm,
  sqFta,
  crossFg,
  crossFt,
  ...line
}: z.infer<typeof windowLineSchema>): FantasyStatLine => ({
  ...line,
  sq: {
    pts: sqPts,
    reb: sqReb,
    ast: sqAst,
    stl: sqStl,
    blk: sqBlk,
    fg3m: sqFg3m,
    tov: sqTov,
    fgm: sqFgm,
    fga: sqFga,
    ftm: sqFtm,
    fta: sqFta,
  },
  cross: { fg: crossFg, ft: crossFt },
});

// All ranges go through game logs (season aggregates lack the second moments
// G-Score's variance term needs). gameLimit null = the whole season. The
// season's logs are ranked newest-first per player and aggregated in SQL, the
// same reduction aggregateWindowLogs runs in memory: integer sums are exact
// either way, and minutes (the one float) is summed newest-first, the order
// the in-memory reduce adds them in, so the totals match to the bit. Prisma's
// nested `take` shipped every log of the season (~26k rows) to trim here.
// Players with no appearance in the window are dropped.
const fetchWindowLines = async ({
  season,
  gameLimit,
}: {
  season: string;
  gameLimit: number | null;
}): Promise<FantasyStatLine[]> => {
  const rows: unknown = await prisma.$queryRaw`
    WITH ranked AS (
      SELECT gl."playerId", gl."gameDate", gl.minutes, gl.pts, gl.reb, gl.ast, gl.stl,
             gl.blk, gl.fg3m, gl.tov, gl.fgm, gl.fga, gl.ftm, gl.fta,
             row_number() OVER (PARTITION BY gl."playerId" ORDER BY gl."gameDate" DESC) AS rn
      FROM "PlayerGameLog" gl
      WHERE gl.season = ${season} AND gl."seasonType" = 'Regular Season'
    ), windowed AS (
      SELECT "playerId",
             (count(*) FILTER (WHERE minutes > 0))::int AS "gamesPlayed",
             sum(minutes ORDER BY "gameDate" DESC)::float8 AS minutes,
             sum(pts)::int AS pts, sum(reb)::int AS reb, sum(ast)::int AS ast,
             sum(stl)::int AS stl, sum(blk)::int AS blk, sum(fg3m)::int AS fg3m,
             sum(tov)::int AS tov, sum(fgm)::int AS fgm, sum(fga)::int AS fga,
             sum(ftm)::int AS ftm, sum(fta)::int AS fta,
             sum(pts * pts)::int AS "sqPts", sum(reb * reb)::int AS "sqReb",
             sum(ast * ast)::int AS "sqAst", sum(stl * stl)::int AS "sqStl",
             sum(blk * blk)::int AS "sqBlk", sum(fg3m * fg3m)::int AS "sqFg3m",
             sum(tov * tov)::int AS "sqTov", sum(fgm * fgm)::int AS "sqFgm",
             sum(fga * fga)::int AS "sqFga", sum(ftm * ftm)::int AS "sqFtm",
             sum(fta * fta)::int AS "sqFta",
             sum(fgm * fga)::int AS "crossFg", sum(ftm * fta)::int AS "crossFt"
      FROM ranked
      WHERE ${gameLimit}::int IS NULL OR rn <= ${gameLimit}::int
      GROUP BY "playerId"
    )
    SELECT p.id AS "playerId", p."firstName", p."lastName", p."fullName", p."teamAbbr",
           p.position, p."nbaPersonId", w.*
    FROM windowed w
    JOIN "Player" p ON p.id = w."playerId"
    WHERE w."gamesPlayed" > 0
    ORDER BY p.id
  `;
  return z.array(windowLineSchema).parse(rows).map(toStatLine);
};

const fetchPool = async ({
  range,
  season: requestedSeason,
}: {
  range: PlayerGameRange;
  season: string | null;
}): Promise<FantasyStatLine[]> => {
  const season = requestedSeason ?? (await latestSeason());
  if (season === null) return [];
  return fetchWindowLines({ season, gameLimit: gamesForRange({ range }) });
};

// Cache key is the range and the season alone — user config (weights, league
// size) must never enter the key, or cardinality is unbounded (PRD §9.1); the
// season is bounded by the backfill window. Same tag and revalidate window as
// the other players caches so one sync invalidation busts every surface.
const cachedPool = unstable_cache(
  (range: PlayerGameRange, season: string | null) => fetchPool({ range, season }),
  ["fantasy:pool"],
  { revalidate: 300, tags: ["players"] },
);

// The Fantasy tab and the home/team surfaces value the latest season; the
// player page passes the season its dropdown selected so a past season is
// measured against its own pool.
export const getFantasyPool = ({
  range,
  season = null,
}: {
  range: PlayerGameRange;
  season?: string | null;
}): Promise<FantasyStatLine[]> => cachedPool(range, season);
