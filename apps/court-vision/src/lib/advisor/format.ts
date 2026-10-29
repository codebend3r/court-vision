import { formatSigned } from "@vision/core/util/format";

const ONE_PLACE = 1;

/** A score or value to one place, signed. Rounded first, so a tiny negative reads "0.0", never "-0.0". */
type FormatScoreProps = { value: number };

export const formatScore = ({ value }: FormatScoreProps): string => {
  const rounded = Number(value.toFixed(ONE_PLACE));
  return formatSigned({ value: rounded === 0 ? 0 : rounded, digits: ONE_PLACE });
};
