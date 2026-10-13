import { Prisma } from "@generated/prisma/client";

import { SEASON_TYPE } from "@/lib/stats/season";

// SQL fragments the player pool queries share. Each is a `Prisma.sql` tagged
// template, so a value inside stays a bound parameter when the fragment is
// spliced into a `$queryRaw`.

// The identity columns of the `p` ("Player") alias, in schema order.
export const PLAYER_IDENTITY_COLUMNS = Prisma.sql`p.id, p."firstName", p."lastName", p."fullName", p."teamAbbr", p.position,
           p."nbaPersonId"`;

// Each player's latest regular-season aggregate row as `s`, or a row of nulls
// when they have none.
export const LATEST_SEASON_JOIN = Prisma.sql`LEFT JOIN LATERAL (
      SELECT ss.* FROM "PlayerSeasonStats" ss
      WHERE ss."playerId" = p.id AND ss."seasonType" = ${SEASON_TYPE}
      ORDER BY ss.season DESC
      LIMIT 1
    ) s ON true`;

// True for a player with at least one game log. Retired players (no logs)
// never list.
export const HAS_GAME_LOGS = Prisma.sql`EXISTS (SELECT 1 FROM "PlayerGameLog" g WHERE g."playerId" = p.id)`;
