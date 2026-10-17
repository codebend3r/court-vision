import { consoleLogger, type Logger } from "@vision/core/util/logger";
import { isMainModule } from "@vision/core/util/runtime";

import { formatLeagueMeta } from "@/lib/leagues/format";
import { loadYahooLeague, readCurrentGameUncached } from "@/lib/yahoo/load";
import { resolveYahooPlayers } from "@/lib/yahoo/matchPlayers";
import { type ImportedTeam } from "@/lib/yahoo/types";
import { parseYahooLeagueUrl } from "@/lib/yahoo/url";

const rosterCount = ({ team }: { team: ImportedTeam }): number =>
  team.slots.filter(({ player }) => !!player).length;

const teamLine = ({ team }: { team: ImportedTeam }): string => {
  const count = rosterCount({ team });
  return `  ${team.name} (${team.managerName ?? "manager hidden"}): ${count} ${count === 1 ? "player" : "players"}`;
};

/**
 * Dry run of a Yahoo import: loads the league from Yahoo and reports what an
 * import would do, without writing anything. Player matching only reads.
 * A failure prints its status and sets `process.exitCode`.
 */
export const probeYahooLeague = async ({
  input,
  logger = consoleLogger,
}: {
  input: string;
  logger?: Logger;
}): Promise<void> => {
  const parsed = parseYahooLeagueUrl({ input });
  if (parsed.status !== "ok") {
    logger(`Cannot read a league from "${input}": ${parsed.status}`);
    process.exitCode = 1;
    return;
  }

  // `readCurrentGameUncached`: the cached read needs the Next runtime.
  const loaded = await loadYahooLeague({
    leagueId: parsed.leagueId,
    readGame: readCurrentGameUncached,
    logger,
  });
  if (loaded.status !== "ok") {
    logger(`Yahoo load failed: ${loaded.status}`);
    process.exitCode = 1;
    return;
  }

  const { league, waiverRefs } = loaded;
  logger(`${league.name} · ${formatLeagueMeta({ league: { ...league, ...league.scoring } })}`);
  if (league.scoring.unsupportedCategories.length) {
    logger(`Unsupported categories: ${league.scoring.unsupportedCategories.join(", ")}`);
  }
  league.teams.forEach((team) => logger(teamLine({ team })));

  const rosterRefs = league.teams.flatMap((team) =>
    team.slots.flatMap(({ player }) => (player ? [player] : [])),
  );
  const { byYahooId, unmatched } = await resolveYahooPlayers({
    refs: [...rosterRefs, ...waiverRefs],
    writeMappings: false,
  });
  logger(
    `matched ${byYahooId.size} of ${byYahooId.size + unmatched.length}; unmatched: ${
      unmatched.map(({ fullName }) => fullName).join(", ") || "none"
    }`,
  );
};

if (isMainModule({ moduleUrl: import.meta.url })) {
  probeYahooLeague({ input: process.argv[2] ?? "" }).catch((error: unknown) => {
    console.error("Yahoo probe failed:", error);
    process.exitCode = 1;
  });
}
