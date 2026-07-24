import { Fragment } from "react";

import styles from "@/components/PositionTag/PositionTag.module.scss";

export type PositionTagProps = {
  position: string;
  className?: string;
};

const GROUP_CLASS: Record<string, string | undefined> = {
  G: styles.g,
  F: styles.f,
  C: styles.c,
};

// Renders an eligibility string ("G", "G-F", …) with each group segment in its
// own color, so G / F / C stay distinguishable even inside a combo.
export function PositionTag({ position, className }: PositionTagProps) {
  const segments = position.split("-");
  return (
    <span className={className}>
      {segments.map((segment, index) => (
        <Fragment key={`${segment}-${index}`}>
          {index > 0 && <span className={styles.separator}>-</span>}
          <span className={GROUP_CLASS[segment.trim().toUpperCase()] ?? styles.other}>
            {segment}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
