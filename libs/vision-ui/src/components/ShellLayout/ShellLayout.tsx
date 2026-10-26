import { type ReactNode } from "react";

// Import order is stylesheet order: the faces, the header's components, the
// global tokens, then the layout's own modules.
import { FONT_VARIABLES } from "#ui/fonts/fonts";
import { ThemeInitScript } from "#ui/components/ThemeInitScript/ThemeInitScript";
import { ThemeProvider } from "#ui/components/ThemeProvider/ThemeProvider";
import { ThemeSwatches } from "#ui/components/ThemeSwatches/ThemeSwatches";
import { Wordmark } from "#ui/components/Wordmark/Wordmark";

import "#ui/styles/globals.scss";

import { MAIN_CONTENT_ID, SkipLink } from "#ui/components/SkipLink/SkipLink";

import styles from "#ui/components/ShellLayout/ShellLayout.module.scss";

// The root layout a *-vision shell app (one with no data source, database or
// auth yet) renders from its app/layout.tsx: the shared fonts and global
// stylesheet, the theme, a skip link, and a header carrying the app's wordmark
// and the theme strip.
type ShellLayoutProps = { lead: string; children: ReactNode };

export function ShellLayout({ lead, children }: ShellLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning className={FONT_VARIABLES}>
      {/* oxlint-disable-next-line nextjs/no-head-element -- App Router root layout markup; the rule only knows to exempt files under app/ */}
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <ThemeProvider>
          <SkipLink />
          <header className={styles.header}>
            <Wordmark lead={lead} />
            <ThemeSwatches />
          </header>
          <div id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.content}>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
