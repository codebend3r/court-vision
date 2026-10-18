"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { syncYahooLeague } from "@/lib/yahoo/actions";
import { formatSyncedAgo } from "@/lib/yahoo/format";
import { unmatchedSyncMessage, yahooFailureMessage } from "@/lib/yahoo/messages";
import { type YahooSyncResult } from "@/lib/yahoo/types";

import styles from "@/components/SyncYahooButton/SyncYahooButton.module.scss";

export type SyncYahooButtonProps = {
  leagueId: string;
  // Names the button for its league where several sit on one page.
  leagueName?: string;
  syncedAt: string | null;
  syncError: string | null;
};

type FailedSync = Exclude<YahooSyncResult, { status: "ok" }>;

// What the last click came to: a sync that landed (and the names it could not
// match), or the message for one that did not.
type SyncOutcome =
  | { kind: "synced"; syncedAt: string; unmatched: string[] }
  | { kind: "failed"; message: string };

// A throw and "not_imported" (a league that is no longer Yahoo's) read as the
// generic failure; "throttled" reads "Synced less than a minute ago.".
const failureMessageFor = ({ result }: { result: FailedSync | null }): string =>
  result === null || result.status === "not_imported"
    ? yahooFailureMessage({ status: "error" })
    : yahooFailureMessage({ status: result.status });

const SYNCING_TEXT = "Syncing…";

const statusTextFor = ({
  isPending,
  outcome,
  syncedAt,
  syncError,
  now,
}: {
  isPending: boolean;
  outcome: SyncOutcome | null;
  syncedAt: string | null;
  syncError: string | null;
  now: Date;
}): string => {
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
}: SyncYahooButtonProps) {
  const router = useRouter();
  const statusId = useId();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  // Fixed at mount (and at each successful sync) so a render never reads the
  // clock; the server's render and hydration may still differ by a band.
  const [now, setNow] = useState(() => new Date());

  const label = isPending ? SYNCING_TEXT : "Sync with Yahoo";

  const sync = () => {
    // aria-disabled, not disabled, while pending: a disabled button drops the
    // focus of the keyboard user who just pressed it.
    if (isPending) return;
    startTransition(async () => {
      const result = await syncYahooLeague({ leagueId }).catch(() => null);
      if (result === null || result.status !== "ok") {
        setOutcome({ kind: "failed", message: failureMessageFor({ result }) });
        return;
      }
      startTransition(() => {
        setOutcome({ kind: "synced", syncedAt: result.syncedAt, unmatched: result.unmatched });
        setNow(new Date());
        router.refresh();
      });
    });
  };

  return (
    <div className={styles.sync}>
      <button
        type="button"
        className={styles.button}
        aria-disabled={isPending}
        aria-label={leagueName === undefined ? undefined : `${label}: ${leagueName}`}
        aria-describedby={statusId}
        onClick={sync}
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
    </div>
  );
}
