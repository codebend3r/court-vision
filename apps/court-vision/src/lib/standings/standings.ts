import { type BdlStanding } from "@/lib/balldontlie/schemas";

export type ConferenceTeamStanding = {
  teamId: number;
  abbreviation: string;
  fullName: string;
  rank: number;
  wins: number;
  losses: number;
};

export type ConferenceStandings = {
  east: ConferenceTeamStanding[];
  west: ConferenceTeamStanding[];
};

const toStanding = (row: BdlStanding): ConferenceTeamStanding => ({
  teamId: row.team.id,
  abbreviation: row.team.abbreviation,
  fullName: row.team.full_name,
  rank: row.conference_rank,
  wins: row.wins,
  losses: row.losses,
});

// The API sends all 30 teams in one flat list; the homepage wants each
// conference ranked on its own ladder. Anything that is not "East" or "West"
// is dropped rather than guessed at.
export const groupStandings = ({ rows }: { rows: readonly BdlStanding[] }): ConferenceStandings => {
  const conference = (name: string): ConferenceTeamStanding[] =>
    rows
      .filter((row) => row.team.conference === name)
      .map(toStanding)
      .sort((a, b) => a.rank - b.rank);
  return { east: conference("East"), west: conference("West") };
};
