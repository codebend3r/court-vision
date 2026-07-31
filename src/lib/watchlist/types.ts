// Why a result union instead of thrown errors: server actions cross the RSC
// boundary, where a thrown error reaches the client as an opaque digest. The
// client has to tell "you hit 50" from "you're signed out" to pick its copy.
export type WatchlistError = "limit" | "unauthenticated" | "error";

export type WatchlistActionResult =
  | { status: "ok"; count: number }
  | { status: "limit"; count: number }
  | { status: "unauthenticated" }
  | { status: "error" };

// Identity fields the homepage panel renders, plus when the star happened so
// callers can order without a second query.
export type WatchlistPlayerSummary = {
  playerId: number;
  fullName: string;
  teamAbbr: string | null;
  position: string | null;
  nbaPersonId: number | null;
  starredAt: string; // ISO date — serializable across the RSC boundary
};
