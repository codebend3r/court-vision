"use client";

import { useAreOwnersKnown } from "@/lib/leagues/rosteredStore";
import {
  OWNER_FILTER_LABELS,
  PLAYER_OWNER_FILTERS,
  type PlayerOwnerFilter,
} from "@/lib/players/ownerFilter";

import styles from "@/components/OwnerQuickFilter/OwnerQuickFilter.module.scss";

export type OwnerQuickFilterProps = {
  value: PlayerOwnerFilter;
  onChange: (owner: PlayerOwnerFilter) => void;
};

// All players, only players on a manager's roster, or only free agents. Shown
// only where the league's rosters are known: without them there is no one to
// call taken or free.
export function OwnerQuickFilter({ value, onChange }: OwnerQuickFilterProps) {
  const isKnown = useAreOwnersKnown();
  return (
    isKnown && (
      <span className={styles.filter} role="group" aria-label="Roster status">
        {PLAYER_OWNER_FILTERS.map((owner) => (
          <button
            key={owner}
            type="button"
            className={styles.option}
            aria-pressed={value === owner}
            onClick={() => onChange(owner)}
          >
            {OWNER_FILTER_LABELS[owner]}
          </button>
        ))}
      </span>
    )
  );
}
