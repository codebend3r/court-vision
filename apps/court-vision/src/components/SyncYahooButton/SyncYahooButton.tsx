"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState, useTransition } from "react";

import { type LeagueSyncVia } from "@/lib/leagues/types";
import { type ClientSyncResult, syncLeagueFromClient } from "@/lib/yahoo/clientSync";
import { YAHOO_STALE_AFTER_MS } from "@/lib/yahoo/constants";
import { formatSyncedAgo } from "@/lib/yahoo/format";
import {
  bridgeFailureMessage,
  unmatchedSyncMessage,
  yahooFailureMessage,
} from "@/lib/yahoo/messages";

import styles from "@/components/SyncYahooButton/SyncYahooButton.module.scss";

export type SyncYahooButtonProps = {
  leagueId: string;
  // Names the button for its league where several sit on one page.
  leagueName?: string;
  syncedAt: string | null;
  syncError: string | null;
  // The path the league syncs on: an extension league is read through the
  // extension in this browser, never by the server.
  syncVia: LeagueSyncVia;
  // The league's Yahoo URL, which the extension path reads the league id from.
  externalUrl: string | null;
  // Syncs once on mount when the league never synced or last synced more than
  // YAHOO_STALE_AFTER_MS ago, through the same handler a click uses.
  autoSyncWhenStale?: boolean;
};

type FailedSync = Exclude<ClientSyncResult, { status: "ok" }>;

// What the last click came to: a sync that landed (and the names it could not
// match), or the message for one that did not. A failure keeps the last sync
// time on show beneath it, except a throttle, whose message is the time.
type SyncOutcome =
  | { kind: "synced"; syncedAt: string; unmatched: string[] }
  | { kind: "failed"; message: string; showsSyncedAt: boolean };

// A throw and "not_imported" (a league that is no longer Yahoo's) read as the
// generic failure; a clicked "throttled" reads "Synced less than a minute ago.".
// An extension that is missing reads as the server's needs_extension refusal.
type FailureMessageForProps = { result: FailedSync | null };

const failureMessageFor = ({ result }: FailureMessageForProps): string => {
  if (result === null || result.status === "not_imported") {
    return yahooFailureMessage({ status: "error" });
  }
  if (result.status === "extension_missing") {
    return yahooFailureMessage({ status: "needs_extension" });
  }
  if (result.status === "extension_failed") return bridgeFailureMessage({ reason: result.reason });
  return yahooFailureMessage({ status: result.status });
};

const SYNCING_TEXT = "Syncing…";

type StatusTextForProps = {
  isPending: boolean;
  outcome: SyncOutcome | null;
  syncedAt: string | null;
  syncError: string | null;
  now: Date;
};

const statusTextFor = ({
  isPending,
  outcome,
  syncedAt,
  syncError,
  now,
}: StatusTextForProps): string => {
  // The status line changes as a sync starts, so its outcome is always news,
  // even one that repeats the stored error the line showed before.
  if (isPending) return SYNCING_TEXT;
  if (outcome === null) return syncError ?? formatSyncedAgo({ syncedAt, now });
  if (outcome.kind === "failed") return outcome.message;
  if (outcome.unmatched.length > 0) return unmatchedSyncMessage({ names: outcome.unmatched });
  return formatSyncedAgo({ syncedAt: outcome.syncedAt, now });
};

// Re-reads an imported league from Yahoo on demand. The status line under the
// keycap says when the league last synced, or why it could not, and is a
// polite live region so the outcome of a click is announced.
export function SyncYahooButton({
  leagueId,
  leagueName,
  syncedAt,
  syncError,
  syncVia,
  externalUrl,
  autoSyncWhenStale = false,
}: SyncYahooButtonProps) {
  const router = useRouter();
  const statusId = useId();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  // Fixed at mount (and at each successful sync) so a render never reads the
  // clock; the server's render and hydration may still differ by a band.
  const [now, setNow] = useState(() => new Date());

  const label = isPending ? SYNCING_TEXT : "Sync with Yahoo";

  type SyncProps = { isAuto: boolean };

  const sync = ({ isAuto }: SyncProps) => {
    // aria-disabled, not disabled, while pending: a disabled button drops the
    // focus of the keyboard user who just pressed it.
    if (isPending) return;
    startTransition(async () => {
      const result = await syncLeagueFromClient({ leagueId, syncVia, externalUrl }).catch(
        () => null,
      );
      // A throttled auto-sync means another sync just ran (or just failed), so
      // its notice would paint over a stored syncError as a false success.
      // Leave the outcome unset and re-read what that sync stored instead.
      if (isAuto && result?.status === "throttled") {
        startTransition(() => {
          router.refresh();
        });
        return;
      }
      if (result === null || result.status !== "ok") {
        setOutcome({
          kind: "failed",
          message: failureMessageFor({ result }),
          showsSyncedAt: result === null || result.status !== "throttled",
        });
        return;
      }
      startTransition(() => {
        setOutcome({ kind: "synced", syncedAt: result.syncedAt, unmatched: result.unmatched });
        setNow(new Date());
        router.refresh();
      });
    });
  };

  // Reads the props and clock as of the mount that fires it, without making
  // the mount effect depend on them.
  const autoSync = useEffectEvent(() => {
    if (!autoSyncWhenStale) return;
    const syncedMs = syncedAt === null ? Number.NaN : Date.parse(syncedAt);
    const isStale = Number.isNaN(syncedMs) || now.getTime() - syncedMs > YAHOO_STALE_AFTER_MS;
    if (isStale) sync({ isAuto: true });
  });
  // React's dev double-invoke runs the effect twice; the ref makes it one sync.
  const hasAutoSynced = useRef(false);

  useEffect(() => {
    if (hasAutoSynced.current) return;
    hasAutoSynced.current = true;
    autoSync();
  }, []);

  return (
    <div className={styles.sync}>
      <button
        type="button"
        className={styles.button}
        aria-disabled={isPending}
        aria-label={leagueName === undefined ? undefined : `${label}: ${leagueName}`}
        aria-describedby={statusId}
        onClick={() => sync({ isAuto: false })}
      >
        {label}
      </button>
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={styles.status}
        suppressHydrationWarning
      >
        {statusTextFor({ isPending, outcome, syncedAt, syncError, now })}
      </p>
      {!isPending && outcome !== null && outcome.kind === "failed" && outcome.showsSyncedAt && (
        <p className={styles.syncedAt}>{formatSyncedAgo({ syncedAt, now })}</p>
      )}
    </div>
  );
}
