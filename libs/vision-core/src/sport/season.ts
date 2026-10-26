// Season labels. Winter leagues (NBA, NHL) span two calendar years and name a
// season by both, padding the end year so 1999 → "1999-00"; summer and fall
// leagues (MLB, NFL) name it by the year it starts.
type CrossYearSeasonLabelProps = { startYear: number };

export const crossYearSeasonLabel = ({ startYear }: CrossYearSeasonLabelProps): string =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

type SingleYearSeasonLabelProps = { startYear: number };

export const singleYearSeasonLabel = ({ startYear }: SingleYearSeasonLabelProps): string =>
  String(startYear);
