import Link from "next/link";

import styles from "@/components/AdvisorView/AdvisorView.module.scss";

export type PlayerNameProps = {
  player: {
    playerId: number;
    fullName: string;
    teamAbbr: string | null;
    position: string | null;
    injuryStatus: string | null;
  };
};

// A player's name, linking to their page, over their team, position and any
// injury status.
export function PlayerName({ player }: PlayerNameProps) {
  const meta = [player.teamAbbr, player.position, player.injuryStatus].flatMap((part) =>
    part ? [part] : [],
  );
  return (
    <span className={styles.player}>
      <Link href={`/players/${player.playerId}`} className={styles.name}>
        {player.fullName}
      </Link>
      {!!meta.length && <span className={styles.meta}>{meta.join(" · ")}</span>}
    </span>
  );
}
