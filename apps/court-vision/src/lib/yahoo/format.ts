import { YAHOO_STALE_AFTER_MS } from "@/lib/yahoo/constants";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// A stamp that is missing or unreadable is NaN, so every caller treats it alike.
type SyncedMsProps = { syncedAt: string | null };

const syncedMs = ({ syncedAt }: SyncedMsProps): number =>
  syncedAt === null ? Number.NaN : Date.parse(syncedAt);

// How long ago an imported league last synced, in whole units: under a minute
// is "just now", then minutes, hours, and days. A sync stamped a moment after
// `now` (clock skew between server and browser) still reads "just now".
type FormatSyncedAgoProps = {
  syncedAt: string | null;
  now: Date;
};

export const formatSyncedAgo = ({ syncedAt, now }: FormatSyncedAgoProps): string => {
  const synced = syncedMs({ syncedAt });
  if (Number.isNaN(synced)) return "Never synced";
  const elapsed = now.getTime() - synced;
  if (elapsed < MINUTE_MS) return "Synced just now";
  if (elapsed < HOUR_MS) return `Synced ${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `Synced ${Math.floor(elapsed / HOUR_MS)} h ago`;
  return `Synced ${Math.floor(elapsed / DAY_MS)} d ago`;
};

// Whether a league is due an automatic sync: it never synced, or last synced
// more than YAHOO_STALE_AFTER_MS before `now`.
type IsSyncStaleProps = {
  syncedAt: string | null;
  now: Date;
};

export const isSyncStale = ({ syncedAt, now }: IsSyncStaleProps): boolean => {
  const synced = syncedMs({ syncedAt });
  return Number.isNaN(synced) || now.getTime() - synced > YAHOO_STALE_AFTER_MS;
};
