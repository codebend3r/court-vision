import { type ReactNode } from "react";

import styles from "@/components/DashboardPanel/DashboardPanel.module.scss";

// One dashboard card: the panel shell titled by an h2 that also names the
// section for assistive tech. `id` is the heading's id; `className` lets the
// page's grid place the panel while the panel stays container-agnostic.
export function DashboardPanel({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
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
export function DashboardPanelEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
