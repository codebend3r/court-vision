import { TeamChip, type TeamChipSize } from "@/components/TeamChip/TeamChip";

import styles from "@/components/TeamMatchup/TeamMatchup.module.scss";

const SEPARATORS: readonly string[] = ["vs.", "@"];

export function TeamMatchup({ matchup, size = "md" }: { matchup: string; size?: TeamChipSize }) {
  const separator = SEPARATORS.find((candidate) => matchup.includes(` ${candidate} `));
  const [team = "", opponent = ""] = separator ? matchup.split(` ${separator} `) : [];

  if (!separator || !team || !opponent) {
    return <span className={styles.matchup}>{matchup}</span>;
  }

  return (
    <span className={styles.matchup}>
      <TeamChip team={team} size={size} />
      <span className={styles.separator}>{separator}</span>
      <TeamChip team={opponent} size={size} />
    </span>
  );
}
