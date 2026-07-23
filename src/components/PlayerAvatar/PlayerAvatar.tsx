"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "@/components/PlayerAvatar/PlayerAvatar.module.scss";
import { teamColorsFor } from "@/components/TeamChip/TeamChip";
import { headshotUrl } from "@/lib/headshots/url";

export type PlayerAvatarSize = "sm" | "lg";

const SIZE_PX: Record<PlayerAvatarSize, number> = { sm: 32, lg: 96 };

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
  const teamStyle = teamColors === null ? undefined : { borderColor: teamColors.primary };

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

  return (
    <Image
      src={headshotUrl({ nbaPersonId })}
      alt={fullName}
      width={dimension}
      height={dimension}
      className={`${styles.avatar} ${sizeClass} ${styles.image}`}
      style={teamStyle}
      onError={() => setFailed(true)}
    />
  );
}
