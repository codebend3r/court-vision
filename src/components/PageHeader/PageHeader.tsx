import Link from "next/link";
import { type ReactNode } from "react";

import styles from "@/components/PageHeader/PageHeader.module.scss";

// Keycap-styled link for the actions slot, so every page action shares one
// look without each page redeclaring it.
export function PageAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.action}>
      {children}
    </Link>
  );
}

// The block every screen opens with (spec §5): eyebrow naming the section,
// the extruded page title, a one-sentence description, right-aligned keycap
// actions on the title baseline, and the accent rule underneath. The page
// container supplies the outer padding; this block only owns its own rhythm.
export type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.titling}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          {!!description && <p className={styles.description}>{description}</p>}
        </div>
        {!!actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div className={styles.rule} />
    </header>
  );
}
