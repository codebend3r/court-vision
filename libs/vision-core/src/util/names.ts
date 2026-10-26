// Lowercases and strips diacritics so "Luka Dončić" matches "Luka Doncic":
// NFD splits each accented letter into its base letter plus a combining mark,
// and the marks (U+0300–U+036F) are dropped.
type NormalizeNameProps = { name: string };

export const normalizeName = ({ name }: NormalizeNameProps): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Sources disagree on punctuation ("A.J. Green" here vs "AJ Green" in the NBA
// index, apostrophes, hyphens), so the match key drops everything but letters,
// digits, and single spaces after diacritic normalization.
type NameMatchKeyProps = { name: string };

export const nameMatchKey = ({ name }: NameMatchKeyProps): string =>
  normalizeName({ name })
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
