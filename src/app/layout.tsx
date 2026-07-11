import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SideNav } from "@/components/SideNav/SideNav";
import { SiteHeader } from "@/components/SiteHeader/SiteHeader";

import "@/styles/globals.scss";

import styles from "./layout.module.scss";

export const metadata: Metadata = {
  title: "Court Vision",
  description: "Find fantasy basketball players trending in the categories you care about.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <div className={styles.shell}>
          <SideNav />
          <div className={styles.content}>{children}</div>
        </div>
      </body>
    </html>
  );
}
