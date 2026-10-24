import { type ReactNode } from "react";

import { ariaSortFor, type SortState } from "@/lib/tableSort";

import styles from "@/components/SortHeader/SortHeader.module.scss";

export type SortHeaderProps = {
  label: ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: ({ key }: { key: string }) => void;
  // Which edge the column's cells sit on, so the label lines up with them.
  align?: "start" | "end";
  // The th's own class: the panel's `numeric` where its cells are numbers.
  className?: string;
  // A tooltip on the header, such as an abbreviation's full name.
  title?: string;
};

// A column header that sorts its table: the th names the sort for assistive
// tech (`aria-sort`), the button inside takes the click, and the arrow shows
// the direction. The arrow's room is always kept, so a header never shifts
// when it becomes the sorted one; on a right-aligned column it leads the
// label, which keeps the label flush with its numbers.
export function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "start",
  className,
  title,
}: SortHeaderProps) {
  const ariaSort = ariaSortFor({ sort, key: sortKey });
  return (
    <th
      scope="col"
      className={className}
      title={title}
      aria-sort={ariaSort}
      data-sort-active={!!ariaSort || undefined}
    >
      <button
        type="button"
        className={styles.sortButton}
        data-align={align}
        onClick={() => onSort({ key: sortKey })}
      >
        <span>{label}</span>
        <span className={styles.sortArrow} aria-hidden="true" data-active={!!ariaSort}>
          {ariaSort === "ascending" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
