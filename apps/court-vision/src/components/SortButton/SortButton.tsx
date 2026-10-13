import { type ComponentProps } from "react";

import { type SortDirection } from "@/lib/players/searchParams";

import styles from "@/components/SortButton/SortButton.module.scss";

export type SortButtonProps = Omit<ComponentProps<"button">, "type" | "children"> & {
  label: string;
  // Whether the list is ordered by this button's column; only then does it
  // take the accent and show its direction.
  isActive: boolean;
  dir: SortDirection;
};

// A client-side sort trigger for a column header: the label, plus ▲/▼ for
// the active direction. The arrow is decorative; a table header announces
// the order through its own `aria-sort`. The container sets the button's
// width and alignment through `className`.
export function SortButton({ label, isActive, dir, className, ...buttonProps }: SortButtonProps) {
  return (
    <button
      type="button"
      {...buttonProps}
      className={`${styles.sortButton} ${className ?? ""}`.trim()}
      data-active={isActive ? "true" : "false"}
    >
      {label}
      {isActive && <span aria-hidden="true">{dir === "asc" ? "▲" : "▼"}</span>}
    </button>
  );
}
