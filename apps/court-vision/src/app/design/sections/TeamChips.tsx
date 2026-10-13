import { TeamChip } from "@/components/TeamChip/TeamChip";
import { NBA_TEAMS } from "@/lib/teams/meta";

import styles from "@/app/design/sections/TeamChips.module.scss";

export function TeamChips() {
  return (
    <div className={styles.teamChipGrid}>
      {NBA_TEAMS.map((team) => (
        <TeamChip key={team.abbreviation} team={team.abbreviation} />
      ))}
    </div>
  );
}
