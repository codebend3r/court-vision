"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Star } from "lucide-react";

import { useLeaguesStore } from "@/lib/leagues/store";
import { starPlayer, unstarPlayer } from "@/lib/watchlist/actions";
import { isWatchlistActionResult } from "@/lib/watchlist/guards";
import { useIsStarred, useWatchlistStore } from "@/lib/watchlist/store";

import styles from "@/components/StarButton/StarButton.module.scss";

export type StarButtonProps = {
  playerId: number;
  fullName: string;
  isSignedIn: boolean;
  size?: "sm" | "md";
};

export function StarButton({ playerId, fullName, isSignedIn, size = "sm" }: StarButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const leagueId = useLeaguesStore((state) => state.activeLeagueId);
  const isStarred = useIsStarred({ playerId });
  const [isPending, startTransition] = useTransition();

  // Signed out, a disabled control is a dead end. A link to sign-in that
  // returns here afterwards is the useful answer.
  if (!isSignedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className={styles.star}
        data-size={size}
        aria-label={`Sign in to star ${fullName}`}
      >
        <Star aria-hidden="true" className={styles.icon} />
      </Link>
    );
  }

  const toggle = () => {
    const { add, remove, setCount, setError, clearError } = useWatchlistStore.getState();
    const rollback = () => (isStarred ? add({ playerId }) : remove({ playerId }));
    clearError();
    // Optimistic: the store flips now, and the action's result either confirms
    // the count or rolls the change back.
    if (isStarred) {
      remove({ playerId });
    } else {
      add({ playerId });
    }
    startTransition(async () => {
      const result = await (
        isStarred ? unstarPlayer({ playerId, leagueId }) : starPlayer({ playerId, leagueId })
      ).catch(() => null);
      // A late reply must not patch a different league's freshly hydrated list.
      if (useLeaguesStore.getState().activeLeagueId !== leagueId) {
        router.refresh();
        return;
      }
      if (!isWatchlistActionResult(result)) {
        rollback();
        setError({ error: "error" });
        // A lost response may still have committed: reconcile from the server.
        router.refresh();
        return;
      }
      if (result.status === "ok") {
        setCount({ count: result.count });
        if (leagueId === null) router.refresh();
        return;
      }
      rollback();
      if (result.status === "limit") {
        setCount({ count: result.count });
        setError({ error: "limit" });
        return;
      }
      setError({ error: result.status });
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      className={styles.star}
      data-size={size}
      aria-pressed={isStarred}
      aria-label={isStarred ? `Unstar ${fullName}` : `Star ${fullName}`}
      disabled={isPending}
      data-pending={isPending || undefined}
      onClick={toggle}
    >
      {/* Fill, not colour, carries the state — colour alone never conveys meaning. */}
      <Star aria-hidden="true" className={styles.icon} fill={isStarred ? "currentColor" : "none"} />
    </button>
  );
}
