// Lowercases and strips diacritics so e.g. "Luka Dončić" matches "Luka Doncic".
export const normalizeName = (name: string): string =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
