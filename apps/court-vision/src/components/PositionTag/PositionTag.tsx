"use client";

import { Fragment } from "react";

import { usePlayerPosition } from "@/lib/leagues/rosteredStore";

import styles from "@/components/PositionTag/PositionTag.module.scss";

export type PositionTagProps = {
  position: string;
  // When given, the league host's own label for this player (Yahoo's
  // "SG,SF,PF") replaces `position` wherever the active league knows one.
  playerId?: number;
  className?: string;
};

const GROUP_CLASS: Record<string, string | undefined> = {
  G: styles.g,
  PG: styles.g,
  SG: styles.g,
  F: styles.f,
  SF: styles.f,
  PF: styles.f,
  C: styles.c,
};

// "G-F" (the NBA data's eligibility) and "SG,SF,PF" (Yahoo's) split alike; the
// label keeps whichever separator it came with.
const SEGMENT_SEPARATOR = /[-,]/;

// Renders an eligibility string ("G-F", "SG,SF,PF", …) with each segment in its
// group's color, so G / F / C stay distinguishable even inside a combo.
export function PositionTag({ position, playerId, className }: PositionTagProps) {
  const label = usePlayerPosition({ playerId: playerId ?? -1, fallback: position }) ?? position;
  const separator = label.includes(",") ? "," : "-";
  const segments = label.split(SEGMENT_SEPARATOR);
  return (
    <span className={className}>
      {segments.map((segment, index) => (
        <Fragment key={`${segment}-${index}`}>
          {index > 0 && <span className={styles.separator}>{separator}</span>}
          <span className={GROUP_CLASS[segment.trim().toUpperCase()] ?? styles.other}>
            {segment}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** A player's position as plain text, the league host's label where it has one. */
export function PlayerPositionText({
  playerId,
  position,
}: {
  playerId: number;
  position: string | null;
}) {
  return <>{usePlayerPosition({ playerId, fallback: position }) ?? "-"}</>;
}
