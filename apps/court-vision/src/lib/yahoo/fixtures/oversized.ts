import gameNba from "@/lib/yahoo/fixtures/game-nba.json";
import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import waivers106344 from "@/lib/yahoo/fixtures/waivers-106344.json";

// Test fixture builders: the Game of Courts payload with one structural count
// pushed past its cap and everything else left as Yahoo answered it.

const fixtureLeague = league106344.fantasy_content.league;
const fixtureTeams = fixtureLeague.teams;
const fixturePagePlayers = waivers106344.fantasy_content.league.players;

const repeated = ({ items, length }: { items: readonly unknown[]; length: number }): unknown[] =>
  Array.from({ length }, (_, index) => items[index % items.length]);

const snapshotWithTeams = ({ teams }: { teams: readonly unknown[] }) => ({
  ...league106344,
  fantasy_content: {
    ...league106344.fantasy_content,
    league: { ...fixtureLeague, teams },
  },
});

/** The Game of Courts snapshot with `count` teams, the fixture's repeated. */
export const snapshotWithTeamCount = ({ count }: { count: number }) =>
  snapshotWithTeams({ teams: repeated({ items: fixtureTeams, length: count }) });

/** The Game of Courts snapshot whose first team rosters `count` players. */
export const snapshotWithRosterSize = ({ count }: { count: number }) =>
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
export const waiverPageWithPlayers = ({ count }: { count: number }) => ({
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
export const gameOfCourtsPayload = ({
  snapshot = league106344,
  waiverPages = [waivers106344],
}: {
  snapshot?: unknown;
  waiverPages?: unknown[];
} = {}) => ({ game: gameNba, snapshot, waiverPages });
