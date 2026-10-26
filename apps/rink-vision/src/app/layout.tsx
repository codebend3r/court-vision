import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ShellLayout } from "@vision/ui/components/ShellLayout/ShellLayout";

import { SHELL } from "@/shell";

export const metadata: Metadata = { title: SHELL.name, description: SHELL.description };

type RootLayoutProps = { children: ReactNode };

export default function RootLayout({ children }: RootLayoutProps) {
  return <ShellLayout lead="Rink">{children}</ShellLayout>;
}
