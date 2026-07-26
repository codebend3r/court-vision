// Browser-safe stand-in for `next/navigation`, aliased in the design-sync Vite
// build. Router methods are no-ops; the object identity is stable so effects
// that depend on `router` don't loop.
const router = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  prefetch: () => {},
  back: () => {},
  forward: () => {},
};

export const useRouter = (): typeof router => router;

export const usePathname = (): string =>
  typeof window === "undefined" ? "/" : window.location.pathname;

export const useSearchParams = (): URLSearchParams =>
  new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);

export const useParams = (): Record<string, string> => ({});

export const useSelectedLayoutSegment = (): string | null => null;
export const useSelectedLayoutSegments = (): string[] => [];

export const redirect = (): void => {};
export const notFound = (): void => {};
