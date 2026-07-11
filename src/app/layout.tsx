import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SideNav } from "@/components/SideNav/SideNav";
import { SiteHeader } from "@/components/SiteHeader/SiteHeader";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import "@/styles/globals.scss";

import styles from "./layout.module.scss";

export const metadata: Metadata = {
  title: "Court Vision",
  description: "Find fantasy basketball players trending in the categories you care about.",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <SiteHeader />
          <div className={styles.shell}>
            <SideNav />
            <div className={styles.content}>{children}</div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
