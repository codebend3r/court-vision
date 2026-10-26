"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useDismiss } from "@vision/ui/hooks/useDismiss";

import styles from "@/components/AccountMenu/AccountMenu.module.scss";

const PANEL_ID = "account-menu";

// The account popover in the header: a disclosure (a button that shows and
// hides a panel of ordinary links and a sign-out button), not an ARIA menu,
// so Tab and Enter work as they do anywhere else. Opening moves focus to the
// first item and Tab cycles within the panel; Escape, a pointer outside, or
// following Settings closes it, and Escape returns focus to the trigger.
type AccountMenuProps = { username: string };

export function AccountMenu({ username }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const lastItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
  }, [open]);

  useDismiss({ open, ref: containerRef, onDismiss: () => setOpen(false) });

  const closeAndRestore = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Keep Tab inside the open panel: past the last item wraps to the first,
  // and Shift+Tab before the first wraps to the last.
  const trapTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const [from, to] = event.shiftKey
      ? [firstItemRef.current, lastItemRef.current]
      : [lastItemRef.current, firstItemRef.current];
    if (document.activeElement !== from) return;
    event.preventDefault();
    to?.focus();
  };

  return (
    <div
      className={styles.menu}
      ref={containerRef}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          closeAndRestore();
        }
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        @{username}
        <span className={styles.initials} aria-hidden="true">
          {username.slice(0, 2)}
        </span>
      </button>
      {open && (
        <div className={styles.dropdown} id={PANEL_ID} onKeyDown={trapTab}>
          <Link
            href="/settings"
            ref={firstItemRef}
            className={styles.settingsLink}
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" ref={lastItemRef} className={styles.signout}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
