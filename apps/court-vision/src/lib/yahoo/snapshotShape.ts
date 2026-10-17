import { isRecord } from "@vision/core/util/record";
import { type BridgeLeaguePayload } from "@vision/yahoo-bridge/protocol";

import { YAHOO_MAX_WAIVER_PAGES, YAHOO_PAGE_SIZE } from "@/lib/yahoo/constants";

// Caps on how much a client-supplied snapshot may hold. Yahoo allows at most 20
// teams and a few dozen roster spots, so a snapshot past these is forged. The
// byte cap alone still lets thousands of tiny teams through, and the import
// work grows much faster than the team count.
export const MAX_SNAPSHOT_TEAMS = 32;

export const MAX_SNAPSHOT_ROSTER_PLAYERS = 64;

export type SnapshotShape = { status: "ok" } | { status: "over" };

const OK: SnapshotShape = { status: "ok" };
const OVER: SnapshotShape = { status: "over" };

const TEAMS_PATH: readonly string[] = ["fantasy_content", "league", "teams"];
const PAGE_PLAYERS_PATH: readonly string[] = ["fantasy_content", "league", "players"];
// Yahoo wraps each team as `{ team }`, so a roster sits under the wrapper.
const ROSTER_PLAYERS_PATH: readonly string[] = ["team", "roster", "players"];

// The value at `path`, or `undefined` once a step isn't an object.
const valueAt = ({ value, path }: { value: unknown; path: readonly string[] }): unknown =>
  path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);

// The array at `path`; anything else counts as empty, and zod judges it later.
const arrayAt = ({
  value,
  path,
}: {
  value: unknown;
  path: readonly string[];
}): readonly unknown[] => {
  const found = valueAt({ value, path });
  return Array.isArray(found) ? found : [];
};

/**
 * Counts the snapshot's waiver pages, each page's players, its teams and each
 * team's roster, reading only array lengths from the raw payload. Runs before
 * any zod parse, so a forged snapshot is refused before it costs real work.
 */
export const checkSnapshotShape = ({
  payload,
}: {
  payload: BridgeLeaguePayload;
}): SnapshotShape => {
  const { snapshot, waiverPages } = payload;
  const teams = arrayAt({ value: snapshot, path: TEAMS_PATH });
  const isOver =
    waiverPages.length > YAHOO_MAX_WAIVER_PAGES ||
    waiverPages.some(
      (page) => arrayAt({ value: page, path: PAGE_PLAYERS_PATH }).length > YAHOO_PAGE_SIZE,
    ) ||
    teams.length > MAX_SNAPSHOT_TEAMS ||
    teams.some(
      (team) =>
        arrayAt({ value: team, path: ROSTER_PLAYERS_PATH }).length > MAX_SNAPSHOT_ROSTER_PLAYERS,
    );
  return isOver ? OVER : OK;
};
