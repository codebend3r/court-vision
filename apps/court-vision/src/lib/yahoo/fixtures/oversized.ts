import gameNba from "@/lib/yahoo/fixtures/game-nba.json";
import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import waivers106344 from "@/lib/yahoo/fixtures/waivers-106344.json";

// Test fixture builders: the Game of Courts payload with one structural count
// pushed past its cap and everything else left as Yahoo answered it.

const fixtureLeague = league106344.fantasy_content.league;
const fixtureTeams = fixtureLeague.teams;
const fixturePagePlayers = waivers106344.fantasy_content.league.players;

type RepeatedProps = { items: readonly unknown[]; length: number };

const repeated = ({ items, length }: RepeatedProps): unknown[] =>
  Array.from({ length }, (_, index) => items[index % items.length]);

type SnapshotWithTeamsProps = { teams: readonly unknown[] };

const snapshotWithTeams = ({ teams }: SnapshotWithTeamsProps) => ({
  ...league106344,
  fantasy_content: {
    ...league106344.fantasy_content,
    league: { ...fixtureLeague, teams },
  },
});

/** The Game of Courts snapshot with `count` teams, the fixture's repeated. */
type SnapshotWithTeamCountProps = { count: number };

export const snapshotWithTeamCount = ({ count }: SnapshotWithTeamCountProps) =>
  snapshotWithTeams({ teams: repeated({ items: fixtureTeams, length: count }) });

/** The Game of Courts snapshot whose first team rosters `count` players. */
type SnapshotWithRosterSizeProps = { count: number };

export const snapshotWithRosterSize = ({ count }: SnapshotWithRosterSizeProps) =>
  snapshotWithTeams({
    teams: fixtureTeams.map((entry, index) =>
      index === 0
        ? {
            team: {
              ...entry.team,
              roster: {
                ...entry.team.roster,
                players: repeated({ items: entry.team.roster.players, length: count }),
              },
            },
          }
        : entry,
    ),
  });

/** A waiver page holding `count` players, the fixture page's repeated. */
type WaiverPageWithPlayersProps = { count: number };

export const waiverPageWithPlayers = ({ count }: WaiverPageWithPlayersProps) => ({
  ...waivers106344,
  fantasy_content: {
    ...waivers106344.fantasy_content,
    league: {
      ...waivers106344.fantasy_content.league,
      players: repeated({ items: fixturePagePlayers, length: count }),
    },
  },
});

/** The Game of Courts payload with each named part replaced. */
type GameOfCourtsPayloadProps = {
  snapshot?: unknown;
  waiverPages?: unknown[];
};

export const gameOfCourtsPayload = ({
  snapshot = league106344,
  waiverPages = [waivers106344],
}: GameOfCourtsPayloadProps = {}) => ({ game: gameNba, snapshot, waiverPages });
