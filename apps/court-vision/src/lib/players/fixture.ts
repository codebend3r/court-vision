import type { GameLogRow } from "@/components/PlayerGameLogTable/gameLogColumns";
import type { PlayerPoolRow } from "@/lib/players/search";
import type { CumulativeSourceLog } from "@/lib/stats/cumulative";
import { NBA_TEAMS } from "@/lib/teams/meta";

// Synthetic data for the /design/players and /design/player perf fixtures.
// Everything derives from an index, with no randomness and no clock, so the
// pages render the same bytes on every CI run and a timing change always means
// the code changed, never the data.

export const FIXTURE_PLAYER_COUNT = 100;
export const FIXTURE_GAME_COUNT = 60;

const FIRST_NAMES = [
  "Alex",
  "Blake",
  "Casey",
  "Drew",
  "Elliot",
  "Finley",
  "Gray",
  "Harper",
  "Indigo",
  "Jordan",
] as const;

const LAST_NAMES = [
  "Adler",
  "Booker",
  "Carver",
  "Dalton",
  "Ellis",
  "Foster",
  "Grady",
  "Hayes",
  "Irving",
  "Jensen",
] as const;

const POSITIONS = ["G", "F", "C", "G-F", "F-C"] as const;

const MILLIS_PER_DAY = 86_400_000;
const FIRST_GAME_DATE = Date.UTC(2026, 9, 22);

type PickProps<Item> = { items: readonly Item[]; index: number };

const pick = <Item>({ items, index }: PickProps<Item>): Item | null =>
  items[index % items.length] ?? null;

// A season line for player `index`: production falls off down the list so the
// default points sort has a real order to render.
type BuildPlayerProps = { index: number };

const buildPlayer = ({ index }: BuildPlayerProps): PlayerPoolRow => {
  const id = index + 1;
  const first = pick({ items: FIRST_NAMES, index }) ?? "";
  const last = pick({ items: LAST_NAMES, index: Math.floor(index / FIRST_NAMES.length) }) ?? "";
  const gamesPlayed = 40 + ((index * 7) % 40);
  const pointsPerGame = 30 - index * 0.2 + ((index * 13) % 5);
  type PerGameProps = { rate: number };

  const perGame = ({ rate }: PerGameProps): number =>
    Math.round(Math.max(0, pointsPerGame) * rate * gamesPlayed);
  return {
    id,
    firstName: first,
    lastName: last,
    fullName: `${first} ${last}`,
    teamAbbr: pick({ items: NBA_TEAMS, index })?.abbreviation ?? null,
    position: pick({ items: POSITIONS, index }),
    nbaPersonId: null,
    stats: {
      gamesPlayed,
      min: Math.round((24 + ((index * 3) % 12)) * gamesPlayed),
      pts: perGame({ rate: 1 }),
      reb: perGame({ rate: 0.3 }),
      ast: perGame({ rate: 0.25 }),
      stl: perGame({ rate: 0.05 }),
      blk: perGame({ rate: 0.04 }),
      fgm: perGame({ rate: 0.36 }),
      fga: perGame({ rate: 0.75 }),
      fg3m: perGame({ rate: 0.1 }),
      fg3a: perGame({ rate: 0.28 }),
      ftm: perGame({ rate: 0.18 }),
      fta: perGame({ rate: 0.22 }),
      tov: perGame({ rate: 0.1 }),
    },
  };
};

export const FIXTURE_PLAYERS: readonly PlayerPoolRow[] = Array.from(
  { length: FIXTURE_PLAYER_COUNT },
  (_, index) => buildPlayer({ index }),
);

// The profile fixture is the list's first row, so the two pages describe one
// player.
export const FIXTURE_PROFILE_PLAYER: PlayerPoolRow = buildPlayer({ index: 0 });

type FixtureGame = Omit<GameLogRow, "gameDate"> & { gameDate: Date };

type BuildGameProps = { index: number };

const buildGame = ({ index }: BuildGameProps): FixtureGame => {
  const fga = 14 + ((index * 3) % 8);
  const fgm = fga - 7 - (index % 3);
  const fg3m = 1 + (index % 3);
  const ftm = 3 + (index % 4);
  const oreb = index % 3;
  const dreb = 4 + (index % 5);
  const isWin = index % 3 !== 0;
  const opponent = pick({ items: NBA_TEAMS, index: index + 5 })?.abbreviation ?? "OPP";
  const team = FIXTURE_PROFILE_PLAYER.teamAbbr ?? "TM";
  const teamScore = 100 + ((index * 7) % 20);
  return {
    id: `fixture-game-${index + 1}`,
    gameNumber: index + 1,
    gameDate: new Date(FIRST_GAME_DATE + index * 2 * MILLIS_PER_DAY),
    matchup: index % 2 === 0 ? `${team} vs. ${opponent}` : `${team} @ ${opponent}`,
    winLoss: isWin ? "W" : "L",
    teamScore,
    opponentScore: teamScore + (isWin ? -(3 + (index % 9)) : 2 + (index % 7)),
    minutes: 28 + ((index * 5) % 9),
    fgm,
    fga,
    fg3m,
    fg3a: 5 + (index % 4),
    ftm,
    fta: ftm + (index % 2),
    oreb,
    dreb,
    reb: oreb + dreb,
    ast: 3 + ((index * 2) % 7),
    stl: index % 3,
    blk: index % 2,
    tov: 1 + (index % 4),
    pts: 2 * fgm + fg3m + ftm,
    plusMinus: isWin ? 4 + (index % 9) : -(2 + (index % 7)),
  };
};

const FIXTURE_GAMES: readonly FixtureGame[] = Array.from(
  { length: FIXTURE_GAME_COUNT },
  (_, index) => buildGame({ index }),
);

// The game log table's rows: dates as ISO strings, as the page serializes them.
export const FIXTURE_GAME_LOG_ROWS: readonly GameLogRow[] = FIXTURE_GAMES.map((game) => ({
  ...game,
  gameDate: game.gameDate.toISOString(),
}));

// The chart's source logs: dates stay Dates.
export const FIXTURE_SOURCE_LOGS: CumulativeSourceLog[] = FIXTURE_GAMES.map((game) => ({
  ...game,
}));
