"use client";

import { MAX_WATCHLIST } from "@/lib/watchlist/constants";
import { useWatchlistStore } from "@/lib/watchlist/store";

import styles from "@/components/WatchlistAlert/WatchlistAlert.module.scss";

// One live region for the whole app: a per-row alert would announce the same
// message once per table row.
export function WatchlistAlert() {
  const lastError = useWatchlistStore((state) => state.lastError);
  const count = useWatchlistStore((state) => state.count);
  if (lastError === null) return null;
  const message =
    lastError === "limit"
      ? `Watchlist full (${count}/${MAX_WATCHLIST}) — unstar someone first.`
      : lastError === "unauthenticated"
        ? "Sign in to star players."
        : "Couldn't update your watchlist. Try again.";
  return (
    <p className={styles.alert} role="alert">
      {message}
    </p>
  );
}
