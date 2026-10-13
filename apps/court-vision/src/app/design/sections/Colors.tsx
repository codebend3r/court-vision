import { TokenSwatch } from "@vision/ui/components/TokenSwatch/TokenSwatch";

import styles from "@/app/design/sections/Colors.module.scss";

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

export function Colors() {
  return (
    <div className={styles.colorGrid}>
      {COLOR_TOKENS.map((token) => (
        <TokenSwatch key={token} token={token} />
      ))}
    </div>
  );
}
