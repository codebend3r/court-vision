"use client";

import Link from "next/link";

import { usePlayerPosition } from "@/lib/leagues/rosteredStore";
import { StarButton } from "@/components/StarButton/StarButton";
import { WaiverBadges } from "@/components/WaiverWireView/WaiverBadges";
import { type WaiverRow } from "@/lib/waiverWire/types";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

export type WaiverPlayerProps = {
  player: Pick<
    WaiverRow,
    "playerId" | "fullName" | "teamAbbr" | "position" | "owner" | "injuryStatus"
  >;
  // Only a free agent can be compared; a list of my players can leave it out.
  onCompare?: ({ fa }: { fa: number }) => void;
  // The view's one hidden hint saying what the compare button does.
  compareHintId: string;
};

// One player's name cell: a star to follow them, their name linking to their
// profile, their badges and team, and, for a free agent, a Compare button that
// opens them head-to-head against my weakest. The name is only ever a link, so
// clicking it never means anything else; the two actions are two controls. The
// badges and the button sit outside the link so its accessible name stays the
// player's name.
export function WaiverPlayer({ player, onCompare, compareHintId }: WaiverPlayerProps) {
  const position = usePlayerPosition({ playerId: player.playerId, fallback: player.position });
  const meta = [player.teamAbbr, position].flatMap((part) => (part ? [part] : [])).join(" · ");

  return (
    <span className={styles.player}>
      <StarButton playerId={player.playerId} fullName={player.fullName} isSignedIn />
      <Link href={`/players/${player.playerId}`} className={styles.name}>
        {player.fullName}
      </Link>
      <WaiverBadges injuryStatus={player.injuryStatus} owner={player.owner} />
      {!!meta && <span className={styles.meta}>{meta}</span>}
      {player.owner !== "mine" && !!onCompare && (
        <button
          type="button"
          className={styles.compareButton}
          aria-label={`Compare ${player.fullName} head-to-head`}
          aria-describedby={compareHintId}
          onClick={() => onCompare({ fa: player.playerId })}
        >
          Compare
        </button>
      )}
    </span>
  );
}
