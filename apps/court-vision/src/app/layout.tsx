import type { Metadata } from "next";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { LegacyTeamsMigrator } from "@/components/LegacyTeamsMigrator/LegacyTeamsMigrator";
import { SessionHydrator } from "@/components/SessionHydrator/SessionHydrator";
import { SideNav } from "@/components/SideNav/SideNav";
import { SiteFooter } from "@/components/SiteFooter/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader/SiteHeader";
import { WatchlistAlert } from "@/components/WatchlistAlert/WatchlistAlert";
import { getProfile } from "@/lib/auth/session";
import { fallbackActiveLeagueId, getLeagues } from "@/lib/leagues/queries";
import {
  getLeaguePositions,
  getLeagueOwners,
  getRosteredPlayerIds,
} from "@/lib/leagues/teamQueries";
import { fontScaleOf } from "@/lib/settings/guards";
import { resolveSiteOrigin } from "@/lib/siteUrl";
import { getWatchlistPlayerIds } from "@/lib/watchlist/queries";
import { MAIN_CONTENT_ID, SkipLink } from "@vision/ui/components/SkipLink/SkipLink";
import { ThemeInitScript } from "@vision/ui/components/ThemeInitScript/ThemeInitScript";
import { ThemeProvider } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { FONT_VARIABLES } from "@vision/ui/fonts/fonts";

import "@/styles/globals.scss";

import styles from "@/app/layout.module.scss";

const description = "Find fantasy basketball players trending in the categories you care about.";

// Absolute URLs for the share card. Shares its resolution with the auth
// confirmation link (see @/lib/siteUrl) so the two can't drift apart. No request
// is available at module scope, so this is the env-only answer.
const siteUrl = resolveSiteOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Court Vision",
  description,
  // opengraph-image.png / twitter-image.png / icon.png in this directory are
  // picked up by Next's file conventions; no explicit `images` entry needed.
  openGraph: {
    type: "website",
    siteName: "Court Vision",
    title: "Court Vision",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Court Vision",
    description,
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  // One watchlist read per navigation seeds every StarButton on the page, and
  // one rostered read tints every player on your teams. All six reads run
  // together rather than as a waterfall on every navigation: the others
  // each resolve the profile themselves (deduped by React cache) and return []
  // signed out, so nothing here needs to wait for `profile` before starting.
  const [profile, watchlistPlayerIds, rosteredPlayerIds, leagueOwners, leaguePositions, leagues] =
    await Promise.all([
      getProfile(),
      getWatchlistPlayerIds(),
      getRosteredPlayerIds(),
      getLeagueOwners(),
      getLeaguePositions(),
      getLeagues(),
    ]);
  // Matches resolveActiveLeague's DB-side fallback (updatedAt desc), not
  // getLeagues' display order (createdAt asc) — see fallbackActiveLeagueId.
  const activeLeagueId = fallbackActiveLeagueId({
    leagues,
    activeLeagueId: profile?.activeLeagueId ?? null,
  });
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-font-scale={fontScaleOf({ profile })}
      className={FONT_VARIABLES}
    >
      <head>
        <ThemeInitScript />
      </head>
      <body>
        {/* Build provenance on window["build-meta"] (version, build date,
            branch, last commit) so a bug report can name the exact build.
            Written into public/ by build-meta on predev/prebuild; the
            generated public/meta.d.ts types the global. */}
        <Script src="/meta.js" strategy="afterInteractive" />
        <NuqsAdapter>
          <ThemeProvider>
            <SkipLink />
            <SiteHeader />
            <SessionHydrator
              watchlistPlayerIds={watchlistPlayerIds}
              rosteredPlayerIds={rosteredPlayerIds}
              leagueOwners={leagueOwners}
              leaguePositions={leaguePositions}
              leagues={leagues}
              activeLeagueId={activeLeagueId}
            />
            {!!profile && <LegacyTeamsMigrator />}
            <WatchlistAlert />
            <div className={styles.shell}>
              {/* 60px-wide relative slot; the rail overlays content when it
                  expands rather than reflowing the page. */}
              {!!profile && (
                <div className={styles.railSlot}>
                  <SideNav />
                </div>
              )}
              {/* Skip-link target. Sits on the wrapper rather than each page's
                  <main> so every route gets it from one place. tabIndex -1
                  makes it programmatically focusable without adding a tab stop. */}
              <div id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.content}>
                {children}
              </div>
            </div>
            <SiteFooter />
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
