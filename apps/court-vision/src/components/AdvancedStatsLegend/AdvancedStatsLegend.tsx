import { StatLegend } from "@/components/StatLegend/StatLegend";
import { ADVANCED_STAT_META } from "@/lib/players/advancedStatMeta";

export function AdvancedStatsLegend() {
  return (
    <StatLegend
      summary="What do these stats mean?"
      columns
      entries={ADVANCED_STAT_META.map((meta) => ({
        key: meta.key,
        term: meta.label,
        fullName: meta.fullName,
        description: meta.description,
        formula: meta.formula,
      }))}
    />
  );
}
