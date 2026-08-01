"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Star } from "lucide-react";

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
      const result = isStarred ? await unstarPlayer({ playerId }) : await starPlayer({ playerId });
      if (!isWatchlistActionResult(result)) {
        rollback();
        setError({ error: "error" });
        return;
      }
      if (result.status === "ok") {
        setCount({ count: result.count });
        return;
      }
      rollback();
      if (result.status === "limit") {
        setCount({ count: result.count });
        setError({ error: "limit" });
        return;
      }
      setError({ error: result.status });
    });
  };

  return (
    <button
      type="button"
      className={styles.star}
      data-size={size}
      aria-pressed={isStarred}
      aria-label={isStarred ? `Unstar ${fullName}` : `Star ${fullName}`}
      data-pending={isPending || undefined}
      onClick={toggle}
    >
      {/* Fill, not colour, carries the state — colour alone never conveys meaning. */}
      <Star aria-hidden="true" className={styles.icon} fill={isStarred ? "currentColor" : "none"} />
    </button>
  );
}
