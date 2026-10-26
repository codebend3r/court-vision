import { type ReactNode } from "react";

import styles from "@/components/DashboardPanel/DashboardPanel.module.scss";

// One dashboard card: the panel shell titled by an h2 that also names the
// section for assistive tech. `id` is the heading's id; `className` lets the
// page's grid place the panel while the panel stays container-agnostic.
type DashboardPanelProps = {
  id: string;
  title: string;
  className?: string;
  children: ReactNode;
};

export function DashboardPanel({ id, title, className, children }: DashboardPanelProps) {
  return (
    <section className={[styles.panel, className].filter(Boolean).join(" ")} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// The muted line a panel shows in place of its content when it has none.
type DashboardPanelEmptyProps = { children: ReactNode };

export function DashboardPanelEmpty({ children }: DashboardPanelEmptyProps) {
  return <p className={styles.empty}>{children}</p>;
}
