import { WEIGHT_FAMILIES } from "@/app/design/sections/FontWeights";

import styles from "@/app/design/sections/Typefaces.module.scss";

const TYPEFACES = WEIGHT_FAMILIES.map(({ name, cssVar }) => ({ name, cssVar }));

export function Typefaces() {
  return (
    <div className={styles.typefaceStack}>
      {TYPEFACES.map((typeface) => (
        <p
          key={typeface.cssVar}
          className={styles.typefaceSample}
          style={{ fontFamily: `var(${typeface.cssVar})` }}
        >
          {typeface.name}
        </p>
      ))}
    </div>
  );
}
