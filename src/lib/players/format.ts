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
