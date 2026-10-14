import specimen from "@/app/design/sections/specimen.module.scss";
import styles from "@/app/design/sections/FontWeights.module.scss";

// The two families the design system loads, each with the weights it loads.
export const WEIGHT_FAMILIES: readonly {
  name: string;
  cssVar: string;
  weights: readonly { token: string; value: number }[];
}[] = [
  {
    name: "Chakra Petch — display",
    cssVar: "--font-display",
    weights: [
      { token: "--font-weight-regular", value: 400 },
      { token: "--font-weight-medium", value: 500 },
      { token: "--font-weight-bold", value: 700 },
    ],
  },
  {
    name: "IBM Plex Sans — body",
    cssVar: "--font-sans",
    weights: [
      { token: "--font-weight-regular", value: 400 },
      { token: "--font-weight-medium", value: 500 },
      { token: "--font-weight-semibold", value: 600 },
    ],
  },
];

export function FontWeights() {
  return (
    <div className={styles.weightStack}>
      {WEIGHT_FAMILIES.map((family) => (
        <div key={family.cssVar} className={styles.weightFamily}>
          <h3 className={specimen.groupTitle}>{family.name}</h3>
          {family.weights.map((weight) => (
            <div key={weight.token} className={styles.weightRow}>
              <span className={specimen.specimenName}>{`${weight.token} (${weight.value})`}</span>
              <p
                className={styles.weightSample}
                style={{
                  fontFamily: `var(${family.cssVar})`,
                  fontWeight: `var(${weight.token})`,
                }}
              >
                Triple double: 32 pts, 11 reb, 10 ast
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
