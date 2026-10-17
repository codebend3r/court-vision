"use client";

import Image from "next/image";
import { useState } from "react";

import styles from "@/components/FantasyTeamLogo/FantasyTeamLogo.module.scss";

export type FantasyTeamLogoSize = "sm" | "md";

// Matches the rendered tile size (1.5rem / 2.5rem) so the requested source
// resolution and the layout agree.
const SIZE_PX: Record<FantasyTeamLogoSize, number> = { sm: 24, md: 40 };

export type FantasyTeamLogoProps = {
  name: string;
  logoUrl: string | null;
  size?: FantasyTeamLogoSize;
};

const firstLetter = ({ word }: { word: string }): string => Array.from(word)[0] ?? "";

// "Better Call Gasol" → "BC"; a one-word name gives its first two letters,
// "Newfoundlanders" → "NE".
const initialsFor = ({ name }: { name: string }): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first = "", second] = words;
  const initials =
    second === undefined
      ? Array.from(first).slice(0, 2).join("")
      : `${firstLetter({ word: first })}${firstLetter({ word: second })}`;
  return initials.toUpperCase();
};

// A fantasy team's logo, always shown beside the team's name, so it is
// decorative (`alt=""`). With no logo, or one that fails to load, the team's
// initials stand in on a neutral chip: team identity never borrows the
// theme's accent colours.
export function FantasyTeamLogo({ name, logoUrl, size = "sm" }: FantasyTeamLogoProps) {
  // Remembers the URL that failed, so a new logo for the same tile gets a try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const dimension = SIZE_PX[size];
  const tileClass = `${styles.logo} ${styles[size]}`;

  if (logoUrl === null || logoUrl === failedUrl) {
    return (
      <span className={tileClass} aria-hidden="true">
        {initialsFor({ name })}
      </span>
    );
  }

  return (
    <span className={tileClass}>
      <Image
        src={logoUrl}
        alt=""
        width={dimension}
        height={dimension}
        className={styles.image}
        onError={() => setFailedUrl(logoUrl)}
      />
    </span>
  );
}
