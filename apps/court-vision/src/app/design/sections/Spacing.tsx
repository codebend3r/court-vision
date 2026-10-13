import specimen from "@/app/design/sections/specimen.module.scss";
import styles from "@/app/design/sections/Spacing.module.scss";

const SPACING_TOKENS: readonly string[] = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-6",
  "--space-8",
];

const SPACING_DEMO_TOKENS: readonly string[] = ["--space-2", "--space-4", "--space-6"];

export function Spacing() {
  return (
    <>
      <div className={styles.spacingStack}>
        {SPACING_TOKENS.map((token) => (
          <div key={token} className={styles.spacingRow}>
            <span className={styles.spacingBar} style={{ width: `var(${token})` }} />
            <span className={styles.spacingLabel}>{token}</span>
          </div>
        ))}
      </div>
      <div className={styles.spacingDemos}>
        <div className={styles.spacingDemo}>
          <h3 className={specimen.groupTitle}>Gap</h3>
          {SPACING_DEMO_TOKENS.map((token) => (
            <div key={token} className={styles.spacingDemoRow}>
              <span className={specimen.specimenName}>{`gap: ${token}`}</span>
              <div className={styles.gapTrack} style={{ gap: `var(${token})` }}>
                {[0, 1, 2, 3].map((box) => (
                  <span key={box} className={styles.gapBox} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.spacingDemo}>
          <h3 className={specimen.groupTitle}>Padding</h3>
          {SPACING_DEMO_TOKENS.map((token) => (
            <div key={token} className={styles.spacingDemoRow}>
              <span className={specimen.specimenName}>{`padding: ${token}`}</span>
              <div className={styles.padBox} style={{ padding: `var(${token})` }}>
                <span className={styles.padInner} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
