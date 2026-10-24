"use client";

import { useOwnership } from "@/lib/leagues/rosteredStore";

import styles from "@/components/OwnershipChip/OwnershipChip.module.scss";

export type OwnershipChipProps = {
  playerId: number;
};

// Says who holds a player in the active league: a free agent, a league-mate's
// team (named), or your own team. Renders nothing where ownership is unknown.
// The words carry the meaning; the color only reinforces it.
export function OwnershipChip({ playerId }: OwnershipChipProps) {
  const ownership = useOwnership({ playerId });
  if (ownership === null) return null;
  const label = ownership.status === "free" ? "Free agent" : ownership.teamName;
  return (
    <span
      className={styles.chip}
      data-ownership={ownership.status}
      title={ownership.status === "free" ? undefined : `On ${ownership.teamName}`}
    >
      {label}
    </span>
  );
}
