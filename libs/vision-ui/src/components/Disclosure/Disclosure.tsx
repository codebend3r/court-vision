import { type ReactNode } from "react";

import styles from "#ui/components/Disclosure/Disclosure.module.scss";

export type DisclosureProps = {
  // The always-visible row, after the chevron.
  summary: ReactNode;
  // What opening the disclosure reveals.
  children: ReactNode;
  // On the <details>: the box it draws (border, surface, gaps).
  className?: string;
  // On the <summary>: the row's layout and type.
  summaryClassName?: string;
  // Starts open; the reader can still fold it.
  open?: boolean;
};

// A native <details>/<summary> fold with the accent chevron every disclosure
// in the apps shares. Native, so it is keyboard-operable (Enter/Space on the
// summary) and announces its expanded state with no script.
export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  open,
}: DisclosureProps) {
  return (
    <details className={`${styles.disclosure} ${className ?? ""}`.trim()} open={open}>
      <summary className={summaryClassName}>
        <span className={styles.chevron} aria-hidden="true">
          ▸
        </span>
        {summary}
      </summary>
      {children}
    </details>
  );
}
