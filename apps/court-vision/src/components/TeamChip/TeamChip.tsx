import { contrastTextFor } from "@/lib/teams/color";
import { teamColorsFor } from "@/lib/teams/meta";

import styles from "@/components/TeamChip/TeamChip.module.scss";

export type TeamChipSize = "sm" | "md";

// A team's abbreviation on its primary color, in whichever ink reads on it.
// An abbreviation the table does not know renders as plain text.
type TeamChipProps = { team: string; size?: TeamChipSize };

export function TeamChip({ team, size = "md" }: TeamChipProps) {
  const details = teamColorsFor({ team });
  const className = size === "sm" ? `${styles.chip} ${styles.sm}` : styles.chip;

  if (!details) {
    return <span className={className}>{team}</span>;
  }

  return (
    <span
      className={className}
      title={details.name}
      aria-label={details.name}
      style={{
        backgroundColor: details.primary,
        color: contrastTextFor({ background: details.primary }),
      }}
    >
      {team}
    </span>
  );
}
