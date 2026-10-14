import { StatLegend } from "@/components/StatLegend/StatLegend";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";
import { type Basis } from "@vision/core/valuation/types";

export type FantasyValueLegendProps = {
  poolSize: number;
  windowLabel: string;
  basis: Basis;
};

// The Fantasy tab's counterpart to AdvancedStatsLegend: one collapsed card
// explaining every method column, the shared pool, and the weight semantics.
export function FantasyValueLegend({ poolSize, windowLabel, basis }: FantasyValueLegendProps) {
  const basisLabel = basis === "perGame" ? "per-game averages" : "totals";
  return (
    <StatLegend
      summary="How is value calculated?"
      entries={[
        ...FANTASY_METHODS.map((method) => ({
          key: method.key,
          term: method.label,
          fullName: method.fullName,
          description: method.description,
          whyItMatters: method.whyItMatters,
          formula: method.formula,
        })),
        {
          key: "pool",
          term: "Pool",
          description:
            `Z-Score and G-Score standardize against the top ${poolSize} qualifying players ` +
            `(${windowLabel}, ${basisLabel}); everyone else is scored against that pool without ` +
            "shifting it. Percentages count through attempt volume, so 55% on 20 shots beats " +
            "90% on 2.",
        },
        {
          key: "weights",
          term: "Weights",
          description:
            "Every method column keeps its own weight set: the Weights panel edits whichever " +
            "column the table is sorted by, and a weight tuned for one column never reshapes " +
            "another. A weight of 0 punts the category; excluding a chip removes it from every " +
            "column. PL Linear ignores weights — it uses the Scoring table instead. Teams × " +
            "roster slots sets the pool size, the VORP replacement rank, and the synthetic " +
            "league that SGP and Sim Value measure against.",
        },
      ]}
    />
  );
}
