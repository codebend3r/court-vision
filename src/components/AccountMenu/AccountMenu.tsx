"use client";

import { useState } from "react";

import styles from "./AccountMenu.module.scss";

export function AccountMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.menu}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        @{username}
      </button>
      {open && (
        <div className={styles.dropdown} role="menu">
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signout}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
