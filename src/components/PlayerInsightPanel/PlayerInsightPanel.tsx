import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { type PlayerCategoryInsight, type PlayerInsight } from "@/lib/fantasyTeams/insights";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

import styles from "@/components/PlayerInsightPanel/PlayerInsightPanel.module.scss";

export type PlayerInsightPanelProps = {
  player: FantasyTeamPlayer | null;
  insight: PlayerInsight | null;
};

// A signed, fixed-precision z: "+2.14" / "-0.40". Zero reads as "+0.00".
const formatSigned = ({ value, digits }: { value: number; digits: number }): string =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;

// Per-game display: rate categories (FG%/FT%) as a leading-dot rate (".488"),
// everything else to one decimal.
const formatPerGame = (category: PlayerCategoryInsight): string =>
  category.kind === "ratio"
    ? category.perGame.toFixed(3).replace(/^0(?=\.)/, "")
    : category.perGame.toFixed(1);

const zToneClass = (z: number): string =>
  z > 0.05 ? styles.zPos : z < -0.05 ? styles.zNeg : styles.zFlat;

// Desktop-only quick-stats read for the hovered roster player: per-game line,
// total z-score, and overall + positional z rank. Hidden on small screens by
// its container; shows a hint until a player is hovered.
export function PlayerInsightPanel({ player, insight }: PlayerInsightPanelProps) {
  if (player === null || insight === null) {
    return (
      <aside className={styles.panel} aria-label="Player quick stats">
        <p className={styles.hint}>Hover a player to see their per-game stats and z-score ranks.</p>
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-label={`${player.fullName} quick stats`}>
      <header className={styles.head}>
        <PlayerAvatar
          fullName={player.fullName}
          nbaPersonId={player.nbaPersonId}
          size="sm"
          teamAbbr={player.teamAbbr}
        />
        <span className={styles.identity}>
          <span className={styles.name}>{player.fullName}</span>
          <span className={styles.meta}>
            {!!player.position && <span className={styles.pos}>{player.position}</span>}
            {player.teamAbbr !== null && <TeamChip team={player.teamAbbr} size="sm" />}
            <span className={styles.games}>
              {insight.gamesPlayed} GP · {insight.minutesPerGame.toFixed(1)} MPG
            </span>
          </span>
        </span>
      </header>

      <dl className={styles.ranks}>
        <div className={styles.rank}>
          <dt>Z-Score</dt>
          <dd className={zToneClass(insight.z)}>{formatSigned({ value: insight.z, digits: 2 })}</dd>
        </div>
        <div className={styles.rank}>
          <dt>Overall</dt>
          <dd>
            #{insight.overallRank} <span className={styles.of}>/ {insight.overallOf}</span>
          </dd>
        </div>
        {insight.positionRank !== null && insight.positionGroup !== null && (
          <div className={styles.rank}>
            <dt>Among {insight.positionGroup}</dt>
            <dd>
              #{insight.positionRank} <span className={styles.of}>/ {insight.positionOf}</span>
            </dd>
          </div>
        )}
      </dl>

      <table className={styles.cats}>
        <thead>
          <tr>
            <th scope="col">Cat</th>
            <th scope="col">Per game</th>
            <th scope="col">z</th>
          </tr>
        </thead>
        <tbody>
          {insight.categories.map((category) => (
            <tr key={category.key}>
              <th scope="row" className={styles.catLabel}>
                {category.label}
              </th>
              <td className={styles.catValue}>{formatPerGame(category)}</td>
              <td className={`${styles.catZ} ${zToneClass(category.z)}`}>
                {formatSigned({ value: category.z, digits: 1 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}
