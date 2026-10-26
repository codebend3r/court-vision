import { z } from "zod";

// What an imported head-to-head league's week looks like once read back: the
// scored categories, every team's totals, and who plays whom. Plain data, so a
// server page can hand it to a client table.

export const statCategoriesSchema = z.array(
  z.object({ statId: z.number(), displayName: z.string(), higherIsBetter: z.boolean() }),
);

// A matchup side's totals as stored: the host's own strings by stat id.
export const statTotalsSchema = z.record(z.string(), z.string());

export type WeekCategory = { statId: number; label: string; higherIsBetter: boolean };

export type WeekTeam = {
  teamId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  managerName: string | null;
  isMine: boolean;
  // Each category's total as the host wrote it ("0.481", "412"), by stat id.
  display: Record<string, string>;
  // The same totals as numbers, null where the host showed no number ("-").
  values: Record<string, number | null>;
};

export type LeagueWeek = {
  // The scoreboard's own freshness, not the latest roster sync.
  syncedAt: string | null;
  week: number;
  weekStart: string | null;
  weekEnd: string | null;
  status: string | null;
  categories: WeekCategory[];
  teams: WeekTeam[];
  // Who plays whom, by team id.
  pairings: { teamAId: string; teamBId: string }[];
};
