import styles from "@/app/design/sections/Radius.module.scss";

const RADIUS_TOKENS: readonly string[] = ["--radius-sm", "--radius-md", "--radius-lg"];

export function Radius() {
  return (
    <div className={styles.radiusGrid}>
      {RADIUS_TOKENS.map((token) => (
        <div key={token} className={styles.radiusTile}>
          <div className={styles.radiusSwatch} style={{ borderRadius: `var(${token})` }} />
          <span className={styles.radiusLabel}>{token}</span>
        </div>
      ))}
    </div>
  );
}
