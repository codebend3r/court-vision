"use client";

import Image from "next/image";
import { useState } from "react";

import { headshotUrl } from "@/lib/headshots/url";

import styles from "@/components/PlayerAvatar/PlayerAvatar.module.scss";

export type PlayerAvatarSize = "sm" | "lg";

const SIZE_PX: Record<PlayerAvatarSize, number> = { sm: 32, lg: 96 };

export type PlayerAvatarProps = {
  fullName: string;
  nbaPersonId: number | null;
  size: PlayerAvatarSize;
};

const initialsFor = (fullName: string): string => {
  const words = fullName.split(" ").filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
};

export function PlayerAvatar({ fullName, nbaPersonId, size }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = SIZE_PX[size];
  const sizeClass = styles[size];

  if (nbaPersonId === null || failed) {
    return (
      <span className={`${styles.avatar} ${sizeClass}`} role="img" aria-label={fullName}>
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
      onError={() => setFailed(true)}
    />
  );
}
