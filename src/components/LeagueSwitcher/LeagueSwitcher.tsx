"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import styles from "@/components/LeagueSwitcher/LeagueSwitcher.module.scss";
import { setActiveLeague } from "@/lib/leagues/actions";
import { useActiveLeague, useLeagues, useLeaguesStore } from "@/lib/leagues/store";

// Active-league picker in the side menu. Optimistic: the store flips first so
// every league-scoped surface updates instantly; router.refresh() re-renders
// the server pages against the new active league.
export function LeagueSwitcher() {
  const router = useRouter();
  const leagues = useLeagues();
  const active = useActiveLeague();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const switcherRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | HTMLAnchorElement | null>>([]);

  // Roving focus: on open, land on the active league (or the first item).
  useEffect(() => {
    if (!open) return;
    const activeIndex = leagues.findIndex((league) => league.id === active?.id);
    const index = activeIndex === -1 ? 0 : activeIndex;
    itemRefs.current[index]?.focus();
  }, [open, leagues, active]);

  // Click/pointer outside the switcher closes the menu.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (switcherRef.current === null) return;
      if (target instanceof Node && switcherRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (leagues.length === 0) return null;

  const pick = ({ leagueId }: { leagueId: string }) => {
    const previousActiveId = useLeaguesStore.getState().activeLeagueId;
    useLeaguesStore.getState().setActive({ leagueId });
    setOpen(false);
    triggerRef.current?.focus();
    void setActiveLeague({ leagueId })
      .then((result) => {
        if (result.status !== "ok") {
          // Revert the optimistic flip; re-read fresh rather than reuse a
          // pre-flip store snapshot, in case something else changed it
          // meanwhile (mirrors LeagueList.setActive).
          useLeaguesStore.setState({ activeLeagueId: previousActiveId });
          setErrorMessage("Could not switch leagues — try again.");
          return;
        }
        setErrorMessage(null);
        router.refresh();
      })
      .catch(() => {
        useLeaguesStore.setState({ activeLeagueId: previousActiveId });
        setErrorMessage("Could not switch leagues — try again.");
      });
  };

  const itemCount = leagues.length + 1;

  const focusItem = (index: number) => {
    const wrapped = ((index % itemCount) + itemCount) % itemCount;
    itemRefs.current[wrapped]?.focus();
  };

  // Tab/Shift+Tab out of the widget closes the menu. Focus is already moving
  // wherever the user sent it, so this does NOT redirect focus back to the
  // trigger (unlike Escape/selection, which explicitly restore it).
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const relatedTarget = event.relatedTarget;
    if (switcherRef.current === null) return;
    if (relatedTarget instanceof Node && switcherRef.current.contains(relatedTarget)) return;
    setOpen(false);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(currentIndex === -1 ? 0 : currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(currentIndex === -1 ? itemCount - 1 : currentIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(itemCount - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <section
      className={styles.switcher}
      aria-label="Active league"
      ref={switcherRef}
      onBlur={handleBlur}
    >
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.label}>{active?.name ?? "Pick a league"}</span>
      </button>
      {!!errorMessage && (
        <p role="alert" className={styles.error}>
          {errorMessage}
        </p>
      )}
      {open && (
        <ul className={styles.list} role="menu" onKeyDown={handleMenuKeyDown}>
          {leagues.map((league, index) => (
            <li key={league.id} className={styles.item} role="none">
              <button
                type="button"
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role="menuitemradio"
                aria-checked={league.id === active?.id}
                tabIndex={-1}
                className={styles.option}
                onClick={() => pick({ leagueId: league.id })}
              >
                {league.name}
              </button>
            </li>
          ))}
          <li className={styles.item} role="none">
            <Link
              href="/leagues"
              ref={(node) => {
                itemRefs.current[leagues.length] = node;
              }}
              role="menuitem"
              tabIndex={-1}
              className={styles.manage}
              onClick={() => setOpen(false)}
            >
              Manage leagues
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}
