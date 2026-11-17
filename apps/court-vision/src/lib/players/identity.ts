import { z } from "zod";

// Who a player is, as every player query selects it off the `p` alias. The id
// is left to each query: the search pools key it `id`, the valuation lines
// `playerId`.
export const playerIdentitySchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  teamAbbr: z.string().nullable(),
  position: z.string().nullable(),
  nbaPersonId: z.number().nullable(),
});

// The same identity as a Prisma `select` on Player, for the queries that read
// it through the client rather than raw SQL.
export const PLAYER_IDENTITY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  teamAbbr: true,
  position: true,
  nbaPersonId: true,
} as const;

// A search pool row's identity, keyed by `id`.
export const playerRowSchema = playerIdentitySchema.extend({ id: z.number() });

export type PlayerIdentity = z.infer<typeof playerRowSchema>;

// A pool query returns identity and stat columns side by side; a ranked row
// carries the identity flat and the stats nested under `stats`.
export const splitPlayerRow = <Row extends PlayerIdentity>({
  id,
  firstName,
  lastName,
  fullName,
  teamAbbr,
  position,
  nbaPersonId,
  ...stats
}: Row): PlayerIdentity & { stats: Omit<Row, keyof PlayerIdentity> } => ({
  id,
  firstName,
  lastName,
  fullName,
  teamAbbr,
  position,
  nbaPersonId,
  stats,
});
