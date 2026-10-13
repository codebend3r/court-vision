import styles from "@/app/design/sections/Typography.module.scss";

const TYPOGRAPHY_TOKENS: readonly string[] = [
  "--font-size-sm",
  "--font-size-md",
  "--font-size-lg",
  "--font-size-xl",
];

export function Typography() {
  return (
    <div className={styles.typeStack}>
      {TYPOGRAPHY_TOKENS.map((token) => (
        <p key={token} className={styles.typeSample} style={{ fontSize: `var(${token})` }}>
          {token}
        </p>
      ))}
    </div>
  );
}
