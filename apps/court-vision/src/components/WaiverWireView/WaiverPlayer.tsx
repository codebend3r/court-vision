import Link from "next/link";

import { WaiverBadges } from "@/components/WaiverWireView/WaiverBadges";
import { type WaiverRow } from "@/lib/waiverWire/types";

import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

export type WaiverPlayerProps = {
  player: Pick<
    WaiverRow,
    "playerId" | "fullName" | "teamAbbr" | "position" | "owner" | "injuryStatus"
  >;
  onCompare: ({ fa }: { fa: number }) => void;
};

// One player's name cell: my players link to their page; a free agent's name
// is a button that opens them head-to-head against my weakest. The badges sit
// outside the button so its accessible name stays the player's name.
export function WaiverPlayer({ player, onCompare }: WaiverPlayerProps) {
  const meta = [player.teamAbbr, player.position]
    .flatMap((part) => (part ? [part] : []))
    .join(" · ");

  return (
    <span className={styles.player}>
      {player.owner === "mine" ? (
        <Link href={`/players/${player.playerId}`} className={styles.name}>
          {player.fullName}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.nameButton}
          onClick={() => onCompare({ fa: player.playerId })}
        >
          {player.fullName}
        </button>
      )}
      <WaiverBadges injuryStatus={player.injuryStatus} owner={player.owner} />
      {!!meta && <span className={styles.meta}>{meta}</span>}
    </span>
  );
}
