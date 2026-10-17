// Throwaway probe: delete this route once the Netlify reachability check for
// Yahoo's read-only fantasy host is done. No auth, no secrets, no query params.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PROBE_URL =
  "https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/league/478.l.1000?format=json_f";
const TIMEOUT_MS = 15_000;

export async function GET(): Promise<NextResponse> {
  try {
    const response = await fetch(PROBE_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = await response.text();

    return NextResponse.json({
      status: response.status,
      ok: response.ok,
      bytes: body.length,
      hasFantasyContent: body.includes("fantasy_content"),
    });
  } catch (error) {
    return NextResponse.json({
      status: 0,
      ok: false,
      bytes: 0,
      hasFantasyContent: false,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}
