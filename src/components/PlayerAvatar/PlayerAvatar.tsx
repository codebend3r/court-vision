"use client";

import Image from "next/image";
import { useState } from "react";

import { teamColorsFor } from "@/components/TeamChip/TeamChip";
import { headshotUrl } from "@/lib/headshots/url";

import styles from "@/components/PlayerAvatar/PlayerAvatar.module.scss";

export type PlayerAvatarSize = "sm" | "lg";

// Matches the rendered tile size (2.25rem / 4.5rem) so the requested source
// resolution and the layout agree.
const SIZE_PX: Record<PlayerAvatarSize, number> = { sm: 36, lg: 72 };

export type PlayerAvatarProps = {
  fullName: string;
  nbaPersonId: number | null;
  size: PlayerAvatarSize;
  teamAbbr?: string | null;
};

const initialsFor = (fullName: string): string => {
  const words = fullName.split(" ").filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
};

export function PlayerAvatar({ fullName, nbaPersonId, size, teamAbbr = null }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = SIZE_PX[size];
  const teamColors = teamColorsFor({ team: teamAbbr });
  const teamRingClass = teamColors === null ? "" : ` ${styles.teamRing}`;
  const sizeClass = `${styles[size]}${teamRingClass}`;
  // Only the left edge carries the team primary (spec §7's team stripe).
  const teamStyle = teamColors === null ? undefined : { borderLeftColor: teamColors.primary };

  if (nbaPersonId === null || failed) {
    return (
      <span
        className={`${styles.avatar} ${sizeClass}`}
        style={teamStyle}
        role="img"
        aria-label={fullName}
      >
        {initialsFor(fullName)}
      </span>
    );
  }

  // The border (including the asymmetric team stripe) lives on the wrapper,
  // never on the Image itself: a border on the img skews its content box off
  // the width/height attributes and trips Next's aspect-ratio warning on
  // every headshot.
  return (
    <span className={`${styles.avatar} ${sizeClass}`} style={teamStyle}>
      <Image
        src={headshotUrl({ nbaPersonId })}
        alt={fullName}
        width={dimension}
        height={dimension}
        className={styles.image}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
