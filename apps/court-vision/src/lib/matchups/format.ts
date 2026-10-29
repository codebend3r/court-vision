// "Oct 20" from Yahoo's "2026-10-20"; null for a missing or unreadable date.
type FormatWeekDateProps = { value: string | null };

export const formatWeekDate = ({ value }: FormatWeekDateProps): string | null => {
  const date = value === null ? null : new Date(`${value}T12:00:00Z`);
  return date === null || Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

// "Oct 20 to Oct 26", or null when either end is missing.
type FormatWeekRangeProps = { weekStart: string | null; weekEnd: string | null };

export const formatWeekRange = ({ weekStart, weekEnd }: FormatWeekRangeProps): string | null => {
  const start = formatWeekDate({ value: weekStart });
  const end = formatWeekDate({ value: weekEnd });
  return start !== null && end !== null ? `${start} to ${end}` : null;
};

// A weekly average: whole numbers for counting stats, three places for a
// ratio (".481"), and a dash when there is nothing to average.
type FormatWeeklyAverageProps = { value: number | null };

export const formatWeeklyAverage = ({ value }: FormatWeeklyAverageProps): string => {
  if (value === null) return "-";
  if (Math.abs(value) < 1 && value !== 0) return value.toFixed(3).replace(/^(-?)0\./, "$1.");
  return value.toFixed(1);
};
