import { formatRate } from "@vision/core/util/format";
import { type CategoryKind } from "@vision/core/valuation/categories";

const MINUS = "−";

// A per-game category number: a ratio category as a rate (".532"), a counting
// one to a tenth ("11.8").
export const formatCategoryValue = ({
  value,
  kind,
}: {
  value: number;
  kind: CategoryKind;
}): string => (kind === "ratio" ? formatRate({ value }) : value.toFixed(1));

// A change at its category's precision, signed with "+" or a true minus
// ("+3.3", "−.002"). A change that rounds to nothing at that precision is a
// bare "0": it reads as no change, so it carries no sign.
export const formatCategoryDelta = ({
  value,
  kind,
}: {
  value: number;
  kind: CategoryKind;
}): string => {
  const magnitude = formatCategoryValue({ value: Math.abs(value), kind });
  if (Number.parseFloat(magnitude) === 0) return "0";
  return `${value > 0 ? "+" : MINUS}${magnitude}`;
};

// A player's value to two decimals, a loss with a true minus ("−0.42"). A
// value that rounds to zero prints unsigned ("0.00").
export const formatValue = ({ value }: { value: number }): string => {
  const magnitude = Math.abs(value).toFixed(2);
  const isNegative = value < 0 && Number.parseFloat(magnitude) !== 0;
  return `${isNegative ? MINUS : ""}${magnitude}`;
};
