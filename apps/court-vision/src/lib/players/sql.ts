import { Prisma } from "@generated/prisma/client";

import { SEASON_LABEL, SEASON_TYPE } from "@/lib/stats/season";

// SQL fragments the player pool queries share. Each is a `Prisma.sql` tagged
// template, so a value inside stays a bound parameter when the fragment is
// spliced into a `$queryRaw`.

// The identity columns of the `p` ("Player") alias, in schema order.
export const PLAYER_IDENTITY_COLUMNS = Prisma.sql`p.id, p."firstName", p."lastName", p."fullName", p."teamAbbr", p.position,
           p."nbaPersonId"`;

// Each player's current-season regular-season aggregate row as `s`, or a row
// of nulls when they have none. Pinned to the current season rather than the
// player's latest one: a player who has not played yet this season would
// otherwise list with last season's line.
export const CURRENT_SEASON_JOIN = Prisma.sql`LEFT JOIN "PlayerSeasonStats" s
      ON s."playerId" = p.id
     AND s.season = ${SEASON_LABEL}
     AND s."seasonType" = ${SEASON_TYPE}`;

// True for a player with at least one game log. Retired players (no logs)
// never list.
export const HAS_GAME_LOGS = Prisma.sql`EXISTS (SELECT 1 FROM "PlayerGameLog" g WHERE g."playerId" = p.id)`;
