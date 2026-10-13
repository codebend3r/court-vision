// Lowercases and strips diacritics so "Luka Dončić" matches "Luka Doncic":
// NFD splits each accented letter into its base letter plus a combining mark,
// and the marks (U+0300–U+036F) are dropped.
export const normalizeName = ({ name }: { name: string }): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
