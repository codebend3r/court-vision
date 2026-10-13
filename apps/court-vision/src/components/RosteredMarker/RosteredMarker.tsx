"use client";

import { useIsRostered } from "@/lib/leagues/rosteredStore";

import styles from "@/components/RosteredMarker/RosteredMarker.module.scss";

export type RosteredMarkerProps = {
  playerId: number;
};

// Sits in a player table's name cell. When the player is on one of your
// teams it names that for screen readers, and its data attribute is the hook
// the shared `data-table` mixin uses to tint the row and draw its edge bar.
export function RosteredMarker({ playerId }: RosteredMarkerProps) {
  const isRostered = useIsRostered({ playerId });
  return (
    isRostered && (
      <span className={styles.marker} data-on-your-team="true">
        On your team
      </span>
    )
  );
}
