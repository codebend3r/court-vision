import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// What the uptime monitor (.github/workflows/uptime.yml) polls. It answers 200
// only when the database is reachable AND its schema matches the code: each
// probe is a `findFirst()` with no `select`, which reads every scalar column
// Prisma expects, so a migration that never reached production fails here
// (P2022, column does not exist) the same way it fails the real pages. That
// is exactly the 2026-10-27 outage, where `League.syncStartedAt` was missing
// and every signed-in page 500'd while signed-out pages still looked fine.
const PROBES = {
  player: () => prisma.player.findFirst(),
  requestRateLimit: () => prisma.requestRateLimit.findFirst(),
  profile: () => prisma.profile.findFirst(),
  league: () => prisma.league.findFirst(),
  leagueTeam: () => prisma.leagueTeam.findFirst(),
  leagueTeamSlot: () => prisma.leagueTeamSlot.findFirst(),
  leagueMatchup: () => prisma.leagueMatchup.findFirst(),
  leagueWatchlistPlayer: () => prisma.leagueWatchlistPlayer.findFirst(),
  playerExternalId: () => prisma.playerExternalId.findFirst(),
  leagueWaiverPlayer: () => prisma.leagueWaiverPlayer.findFirst(),
  playerSeasonStats: () => prisma.playerSeasonStats.findFirst(),
  playerGameLog: () => prisma.playerGameLog.findFirst(),
  playerAdvancedGameLog: () => prisma.playerAdvancedGameLog.findFirst(),
} satisfies Record<string, () => Promise<unknown>>;

type ProbeName = keyof typeof PROBES;
type ProbeResult = { name: ProbeName; ok: boolean };

type RunProbeProps = { name: ProbeName };

async function runProbe({ name }: RunProbeProps): Promise<ProbeResult> {
  try {
    await PROBES[name]();
    return { name, ok: true };
  } catch (error) {
    // The error stays in the function log; the public body names only the
    // table, so the probe never leaks connection strings or query text.
    console.error(`Health probe failed: ${name}`, error);
    return { name, ok: false };
  }
}

const PROBE_NAMES = Object.keys(PROBES).filter((name): name is ProbeName => name in PROBES);

export async function GET(): Promise<NextResponse> {
  const results = await Promise.all(PROBE_NAMES.map((name) => runProbe({ name })));
  const failing = results.filter((result) => !result.ok).map((result) => result.name);
  const healthy = failing.length === 0;

  return NextResponse.json(
    { status: healthy ? "ok" : "down", failing },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
