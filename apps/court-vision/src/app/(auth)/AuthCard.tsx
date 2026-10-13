import { type ReactNode } from "react";

import { LogoLockup } from "@/components/Logo/Logo";

import authStyles from "@/app/(auth)/auth.module.scss";

// The centred card every auth screen is: the vertical logo lockup over the
// screen's h1, then its form. `titleId` ties the card's region to that h1.
export function AuthCard({
  titleId,
  title,
  children,
}: {
  titleId: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className={authStyles.shell} data-centered>
      <section className={authStyles.card} aria-labelledby={titleId}>
        <LogoLockup orientation="vertical" />
        <h1 className={authStyles.title} id={titleId}>
          {title}
        </h1>
        {children}
      </section>
    </main>
  );
}
