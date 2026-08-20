"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/AccountMenu/AccountMenu.module.scss";

const MENU_ID = "account-menu";

export function AccountMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  // Land the keyboard on the first item instead of leaving focus on the
  // trigger, which is what makes the menu operable without a pointer.
  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
  }, [open]);

  // Pointer outside the menu closes it, mirroring LeagueSwitcher.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (menuRef.current === null) return;
      if (target instanceof Node && menuRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const closeAndRestore = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className={styles.menu}
      ref={menuRef}
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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => setOpen((value) => !value)}
      >
        @{username}
        <span className={styles.initials} aria-hidden="true">
          {username.slice(0, 2)}
        </span>
      </button>
      {open && (
        <div className={styles.dropdown} id={MENU_ID} role="menu">
          <Link
            href="/settings"
            role="menuitem"
            ref={firstItemRef}
            className={styles.settingsLink}
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          {/* role="none" so the form does not sit between the menu and its
              item: an owned menuitem must be a child of the menu, and without
              this the sign-out button is skipped in AT menu mode entirely. */}
          <form action="/auth/signout" method="post" role="none">
            <button type="submit" role="menuitem" className={styles.signout}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
