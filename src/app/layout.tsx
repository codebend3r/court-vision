import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { SideNav } from "@/components/SideNav/SideNav";
import { SiteFooter } from "@/components/SiteFooter/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader/SiteHeader";
import { getUser } from "@/lib/auth/session";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import "@/styles/globals.scss";

import styles from "@/app/layout.module.scss";

const displayFont = Chakra_Petch({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-next",
});

const bodyFont = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body-next",
});

const monoFont = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-next",
});

const description = "Find fantasy basketball players trending in the categories you care about.";

// Absolute URLs for the share card. Netlify sets DEPLOY_PRIME_URL/URL at build
// time; NEXT_PUBLIC_SITE_URL overrides both once a custom domain is wired up.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.DEPLOY_PRIME_URL ??
  process.env.URL ??
  "http://localhost:3000";

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

const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await getUser();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <NuqsAdapter>
          <ThemeProvider>
            <SiteHeader />
            <div className={styles.shell}>
              {!!user && <SideNav />}
              <div className={styles.content}>{children}</div>
            </div>
            <SiteFooter />
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
