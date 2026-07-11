export const PAGE_SIZES: readonly number[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_QUERY_LENGTH = 100;

export interface PlayersSearchParams {
  q: string;
  page: number;
  size: number;
  includeRetired: boolean;
}

export const parsePlayersSearchParams = (raw: {
  q?: string;
  page?: string;
  size?: string;
  retired?: string;
}): PlayersSearchParams => {
  const q = (raw.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const parsedPage = Number.parseInt(raw.page ?? "", 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  const parsedSize = Number.parseInt(raw.size ?? "", 10);
  const size = PAGE_SIZES.includes(parsedSize) ? parsedSize : DEFAULT_PAGE_SIZE;
  return { q, page, size, includeRetired: raw.retired === "1" };
};
