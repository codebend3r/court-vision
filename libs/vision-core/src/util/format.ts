export const formatHeight = (args: { heightInches: number | null }): string | null => {
  const { heightInches } = args;
  if (heightInches === null || heightInches <= 0) {
    return null;
  }
  const feet = Math.floor(heightInches / 12);
  const inches = heightInches % 12;
  return `${feet}'${inches}"`;
};

export const formatWeight = (args: { weightLbs: number | null }): string | null => {
  const { weightLbs } = args;
  return weightLbs === null || weightLbs <= 0 ? null : `${weightLbs} lb`;
};

export const formatBirthDate = (args: { birthDate: Date | null }): string | null => {
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
export const formatExperience = (args: {
  draftYear: number | null;
  seasonStartYear: number;
}): string | null => {
  const { draftYear, seasonStartYear } = args;
  if (draftYear === null || draftYear > seasonStartYear) {
    return null;
  }
  const seasons = seasonStartYear - draftYear + 1;
  return seasons === 1 ? "1 season" : `${seasons} seasons`;
};

export const formatOrdinal = (args: { value: number }): string => {
  const { value } = args;
  const mod100 = value % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? "th" : (["th", "st", "nd", "rd"][value % 10] ?? "th");
  return `${value}${suffix}`;
};

export const formatDraft = (args: {
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
}): string | null => {
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
export const formatSigned = (args: {
  value: number;
  digits: number;
  signZero?: boolean;
}): string => {
  const { value, digits, signZero = false } = args;
  const isPlus = signZero ? value >= 0 : value > 0;
  return `${isPlus ? "+" : ""}${value.toFixed(digits)}`;
};

// A make rate the way box scores print it, to three places with the leading
// zero dropped: 0.48 reads ".480". A perfect 1 keeps its digit ("1.000").
export const formatRate = (args: { value: number }): string =>
  args.value.toFixed(3).replace(/^0(?=\.)/, "");
