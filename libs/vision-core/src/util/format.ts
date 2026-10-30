type FormatHeightProps = { heightInches: number | null };

export const formatHeight = (args: FormatHeightProps): string | null => {
  const { heightInches } = args;
  if (heightInches === null || heightInches <= 0) {
    return null;
  }
  const feet = Math.floor(heightInches / 12);
  const inches = heightInches % 12;
  return `${feet}'${inches}"`;
};

type FormatWeightProps = { weightLbs: number | null };

export const formatWeight = (args: FormatWeightProps): string | null => {
  const { weightLbs } = args;
  return weightLbs === null || weightLbs <= 0 ? null : `${weightLbs} lb`;
};

type FormatBirthDateProps = { birthDate: Date | null };

export const formatBirthDate = (args: FormatBirthDateProps): string | null => {
  const { birthDate } = args;
  return (
    birthDate?.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }) ?? null
  );
};

// Seasons in the league counted inclusively from the draft season: a player
// drafted in 2021 is in their 5th season during 2025-26. Undrafted players
// (null draft year) have no derivable count and return null.
type FormatExperienceProps = {
  draftYear: number | null;
  seasonStartYear: number;
};

export const formatExperience = (args: FormatExperienceProps): string | null => {
  const { draftYear, seasonStartYear } = args;
  if (draftYear === null || draftYear > seasonStartYear) {
    return null;
  }
  const seasons = seasonStartYear - draftYear + 1;
  return seasons === 1 ? "1 season" : `${seasons} seasons`;
};

type FormatOrdinalProps = { value: number };

export const formatOrdinal = (args: FormatOrdinalProps): string => {
  const { value } = args;
  const mod100 = value % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? "th" : (["th", "st", "nd", "rd"][value % 10] ?? "th");
  return `${value}${suffix}`;
};

type FormatDraftProps = {
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
};

export const formatDraft = (args: FormatDraftProps): string | null => {
  const { draftYear, draftRound, draftNumber } = args;
  if (draftYear === null) {
    return null;
  }
  const isDraftPart = (part: string | null): part is string => part !== null;
  return [
    String(draftYear),
    draftRound === null ? null : `Rd ${draftRound}`,
    draftNumber === null ? null : `Pick ${draftNumber}`,
  ]
    .filter(isDraftPart)
    .join(" · ");
};

// A fixed-precision number with an explicit "+" on gains: "+1.4" / "-2.1".
// Zero is unsigned ("0.0") unless `signZero` asks for "+0.00", the reading a
// z-score panel wants, where zero means "exactly average" rather than "none".
type FormatSignedProps = {
  value: number;
  digits: number;
  signZero?: boolean;
};

export const formatSigned = (args: FormatSignedProps): string => {
  const { value, digits, signZero = false } = args;
  const isPlus = signZero ? value >= 0 : value > 0;
  return `${isPlus ? "+" : ""}${value.toFixed(digits)}`;
};

// A fantasy score or value to one place, signed. Rounded first, so a tiny
// negative reads "0.0", never "-0.0".
type FormatScoreProps = { value: number };

export const formatScore = ({ value }: FormatScoreProps): string => {
  const rounded = Number(value.toFixed(1));
  return formatSigned({ value: rounded === 0 ? 0 : rounded, digits: 1 });
};

// A make rate the way box scores print it, to three places with the leading
// zero dropped: 0.48 reads ".480". A perfect 1 keeps its digit ("1.000").
type FormatRateProps = { value: number };

export const formatRate = (args: FormatRateProps): string =>
  args.value.toFixed(3).replace(/^0(?=\.)/, "");
