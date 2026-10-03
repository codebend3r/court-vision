import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeInitScript } from "@vision/ui/components/ThemeInitScript/ThemeInitScript";
import { ThemeProvider } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { ThemeSwatches } from "@vision/ui/components/ThemeSwatches/ThemeSwatches";
import { Wordmark } from "@vision/ui/components/Wordmark/Wordmark";

import "@/styles/globals.scss";

import styles from "@/app/layout.module.scss";

// The design system's three faces, exposed as the CSS variables its tokens
// read (--font-display-next and friends).
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

export const metadata: Metadata = {
  title: "Field Vision",
  description:
    "Fantasy football analytics: PPR points and value over replacement at every position.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <ThemeProvider>
          <a href="#main-content" className={styles.skipLink}>
            Skip to main content
          </a>
          <header className={styles.header}>
            <Wordmark lead="Field" />
            <ThemeSwatches />
          </header>
          <div id="main-content" tabIndex={-1} className={styles.content}>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
