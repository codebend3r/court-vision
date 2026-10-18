const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// How long ago an imported league last synced, in whole units: under a minute
// is "just now", then minutes, hours, and days. A sync stamped a moment after
// `now` (clock skew between server and browser) still reads "just now".
export const formatSyncedAgo = ({
  syncedAt,
  now,
}: {
  syncedAt: string | null;
  now: Date;
}): string => {
  const syncedMs = syncedAt === null ? Number.NaN : Date.parse(syncedAt);
  if (Number.isNaN(syncedMs)) return "Never synced";
  const elapsed = now.getTime() - syncedMs;
  if (elapsed < MINUTE_MS) return "Synced just now";
  if (elapsed < HOUR_MS) return `Synced ${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `Synced ${Math.floor(elapsed / HOUR_MS)} h ago`;
  return `Synced ${Math.floor(elapsed / DAY_MS)} d ago`;
};
