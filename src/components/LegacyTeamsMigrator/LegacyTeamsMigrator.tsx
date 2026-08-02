"use client";

import { useEffect } from "react";

import { importLegacyTeams } from "@/lib/leagues/teamActions";
import { parseLegacyTeamsPayload } from "@/lib/leagues/teams";

const LEGACY_KEY = "court-vision-fantasy-teams";

// One-time migration of pre-league localStorage teams into the default league.
// The key is only cleared once the server has them (or explicitly skipped),
// so a failed request retries on the next visit.
export function LegacyTeamsMigrator() {
  useEffect(() => {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) return;
    const parsed: unknown = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();
    const teams = parseLegacyTeamsPayload(parsed);
    if (teams === null || teams.length === 0) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    void importLegacyTeams({ teams }).then((result) => {
      if (result.status === "ok" || result.status === "skipped") {
        localStorage.removeItem(LEGACY_KEY);
      }
    });
  }, []);
  return null;
}
