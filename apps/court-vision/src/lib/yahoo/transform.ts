import {
  type YahooLeagueSnapshot,
  type YahooMatchup,
  type YahooPlayer,
  type YahooPlayersPage,
  type YahooScoreboard,
  type YahooTeam,
} from "@/lib/yahoo/schemas";
import { mapLeagueSettings, toSlotType } from "@/lib/yahoo/settings";
import {
  type ImportedLeague,
  type ImportedMatchup,
  type ImportedSlot,
  type ImportedStatCategory,
  type ImportedTeam,
  type YahooPlayerRef,
} from "@/lib/yahoo/types";
import { type RosterSlotType } from "@vision/sport-basketball/types";

export type TransformResult =
  | { status: "ok"; league: ImportedLeague }
  | { status: "unsupported"; reason: "highscore" | "scoring_type" };

const HIDDEN_MANAGER = "--hidden--";

const toPlayerRef = ({ player }: { player: YahooPlayer }): YahooPlayerRef => ({
  yahooPlayerId: player.player_id,
  fullName: player.name.full,
  teamAbbr: player.editorial_team_abbr ?? null,
  eligiblePositions: player.eligible_positions,
  displayPosition: player.display_position?.trim() || null,
  status: player.status ?? null,
});

// Fills the first empty layout slot of the player's type, else appends a slot of
// that type, so no one on a Yahoo roster is dropped.
const seat = ({
  slots,
  player,
}: {
  slots: readonly ImportedSlot[];
  player: YahooPlayer;
}): ImportedSlot[] => {
  const slotType = toSlotType({ position: player.selected_position?.position ?? null });
  const ref = toPlayerRef({ player });
  const index = slots.findIndex((slot) => slot.slotType === slotType && slot.player === null);
  return index === -1
    ? [...slots, { slotType, player: ref }]
    : slots.map((slot, at) => (at === index ? { slotType, player: ref } : slot));
};

const toManagerName = ({ team }: { team: YahooTeam }): string | null =>
  team.managers
    .map(({ nickname }) => nickname)
    .find((nickname) => !!nickname && nickname !== HIDDEN_MANAGER) ?? null;

const toImportedTeam = ({
  team,
  slotLayout,
}: {
  team: YahooTeam;
  slotLayout: readonly RosterSlotType[];
}): ImportedTeam => ({
  externalKey: team.team_key,
  name: team.name,
  logoUrl: team.team_logos[0]?.url ?? null,
  managerName: toManagerName({ team }),
  isOwnedByCurrentLogin: team.is_owned_by_current_login,
  slots: team.roster.players.reduce<ImportedSlot[]>(
    (slots, player) => seat({ slots, player }),
    slotLayout.map((slotType) => ({ slotType, player: null })),
  ),
});

// Yahoo marks turnovers `sort_order` "0"; a payload without it falls back to
// that one known case.
const TURNOVERS_STAT_ID = 19;

const toStatCategories = ({
  league,
}: {
  league: YahooLeagueSnapshot["fantasy_content"]["league"];
}): ImportedStatCategory[] =>
  league.settings.stat_categories.stats
    .filter((stat) => !stat.is_only_display_stat)
    .map((stat) => ({
      statId: stat.stat_id,
      displayName: stat.display_name,
      higherIsBetter: (stat.sort_order ?? (stat.stat_id === TURNOVERS_STAT_ID ? "0" : "1")) !== "0",
    }));

// Keep a bye team's totals even though it has no opponent.
const toImportedMatchup = ({ matchup }: { matchup: YahooMatchup }): ImportedMatchup[] => {
  const [first, second, ...rest] = matchup.teams;
  if (!first || rest.length) return [];
  const side = (team: typeof first) => ({
    teamKey: team.team_key,
    stats: Object.fromEntries(
      team.team_stats.stats.map(({ stat_id, value }) => [String(stat_id), value]),
    ),
  });
  return [
    {
      week: matchup.week,
      weekStart: matchup.week_start ?? null,
      weekEnd: matchup.week_end ?? null,
      status: matchup.status ?? null,
      sides: second ? [side(first), side(second)] : [side(first)],
    },
  ];
};

/** Turns a parsed Yahoo league snapshot into a provider-neutral league, or reports why it can't be imported. */
export const toImportedLeague = ({
  snapshot,
  scoreboard,
}: {
  snapshot: YahooLeagueSnapshot;
  scoreboard?: YahooScoreboard;
}): TransformResult => {
  const league = snapshot.fantasy_content.league;
  const settings = mapLeagueSettings({ league });
  if (settings.status === "unsupported") return settings;
  const isCategories = settings.scoring.scoringType === "h2h_categories";

  return {
    status: "ok",
    league: {
      externalKey: league.league_key,
      externalUrl: league.url,
      name: league.name,
      logoUrl: league.logo_url ?? null,
      season: league.season,
      teamCount: settings.teamCount,
      rosterSlots: settings.rosterSlots,
      scoring: settings.scoring,
      statCategories: isCategories ? toStatCategories({ league }) : [],
      matchups: !isCategories
        ? []
        : scoreboard === undefined
          ? null
          : scoreboard.fantasy_content.league.scoreboard.matchups.flatMap((matchup) =>
              toImportedMatchup({ matchup }),
            ),
      teams: league.teams.map((team) => toImportedTeam({ team, slotLayout: settings.slotLayout })),
    },
  };
};

/** Flattens players pages into refs, keeping the first occurrence of each Yahoo player id. */
export const toPlayerRefs = ({ pages }: { pages: readonly YahooPlayersPage[] }): YahooPlayerRef[] =>
  pages
    .flatMap((page) => page.fantasy_content.league.players)
    .map((player) => toPlayerRef({ player }))
    .filter(
      (ref, index, refs) =>
        refs.findIndex((other) => other.yahooPlayerId === ref.yahooPlayerId) === index,
    );
