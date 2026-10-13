// Every cache derived from synced NBA data shares one tag, so a sync can bust
// them all at once with `revalidateTag`, and one revalidate window.
export const PLAYERS_CACHE_TAG = "players";

export const PLAYERS_CACHE_REVALIDATE_SECONDS = 300;

// The `unstable_cache` options those caches pass.
export const PLAYERS_CACHE_OPTIONS = {
  revalidate: PLAYERS_CACHE_REVALIDATE_SECONDS,
  tags: [PLAYERS_CACHE_TAG],
};
