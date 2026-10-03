// NBA CDN headshot base — the plan pins this exact template; do not change
// resolution/segment without updating the plan (docs/superpowers/plans/2026-07-11-player-headshots.md).
const HEADSHOT_BASE_URL = "https://cdn.nba.com/headshots/nba/latest/1040x760";

export const headshotUrl = ({ nbaPersonId }: { nbaPersonId: number }): string =>
  `${HEADSHOT_BASE_URL}/${nbaPersonId}.png`;
