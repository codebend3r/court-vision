import { ChartPaletteSwatches } from "@/components/ChartPaletteSwatches/ChartPaletteSwatches";
import { TokenSwatch } from "@/components/TokenSwatch/TokenSwatch";

import styles from "./page.module.scss";

const COLOR_TOKENS: readonly string[] = [
  "--color-bg",
  "--color-surface",
  "--color-border",
  "--color-text",
  "--color-text-muted",
  "--color-accent",
  "--color-accent-strong",
  "--color-highlight",
];

const TYPOGRAPHY_TOKENS: readonly string[] = [
  "--font-size-sm",
  "--font-size-md",
  "--font-size-lg",
  "--font-size-xl",
];

const SPACING_TOKENS: readonly string[] = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-6",
  "--space-8",
];

const RADIUS_TOKENS: readonly string[] = ["--radius-sm", "--radius-md", "--radius-lg"];

export default function DesignPage() {
  return (
    <main className={styles.page}>
      <h1>Design system</h1>

      <section className={styles.section}>
        <h2>Colors</h2>
        <div className={styles.colorGrid}>
          {COLOR_TOKENS.map((token) => (
            <TokenSwatch key={token} token={token} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Chart palettes</h2>
        <ChartPaletteSwatches />
      </section>

      <section className={styles.section}>
        <h2>Typography</h2>
        <div className={styles.typeStack}>
          {TYPOGRAPHY_TOKENS.map((token) => (
            <p key={token} className={styles.typeSample} style={{ fontSize: `var(${token})` }}>
              {token}
            </p>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Spacing</h2>
        <div className={styles.spacingStack}>
          {SPACING_TOKENS.map((token) => (
            <div key={token} className={styles.spacingRow}>
              <span className={styles.spacingBar} style={{ width: `var(${token})` }} />
              <span className={styles.spacingLabel}>{token}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Radius</h2>
        <div className={styles.radiusGrid}>
          {RADIUS_TOKENS.map((token) => (
            <div key={token} className={styles.radiusTile}>
              <div className={styles.radiusSwatch} style={{ borderRadius: `var(${token})` }} />
              <span className={styles.radiusLabel}>{token}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
