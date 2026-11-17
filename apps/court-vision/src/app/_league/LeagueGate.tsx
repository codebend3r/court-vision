import { type ReactNode } from "react";

import { SyncYahooButton } from "@/components/SyncYahooButton/SyncYahooButton";
import { type LeagueSummary } from "@/lib/leagues/types";
import {
  PageAction,
  PageHeader,
  type PageHeaderProps,
} from "@vision/ui/components/PageHeader/PageHeader";

import styles from "@/app/_league/LeagueGate.module.scss";

// The building blocks every league screen (/advisor, /matchup, /roster,
// /waiver-wire) shares: the status line a gate shows, the gate page around it,
// and the Yahoo actions in a ready view's header.

// Why the screen has nothing to show yet, and (as children) what to do about it.
type LeagueStatusProps = { label: string; message: string; children?: ReactNode };

export function LeagueStatus({ label, message, children }: LeagueStatusProps) {
  return (
    <section className={styles.status} aria-label={label}>
      <p className={styles.message}>{message}</p>
      {children}
    </section>
  );
}

// Every state short of the ready view: the page's own header, then its status.
type LeagueGateProps = LeagueStatusProps & { header: PageHeaderProps };

export function LeagueGate({ header, ...status }: LeagueGateProps) {
  return (
    <main className={styles.page}>
      <PageHeader {...header} />
      <LeagueStatus {...status} />
    </main>
  );
}

// The next step for a screen that needs a league imported from Yahoo.
export function ImportFromYahooAction() {
  return <PageAction href="/leagues/import">Import from Yahoo</PageAction>;
}

// The league's sync control, syncing on arrival when the last sync is stale.
type LeagueSyncButtonProps = { league: LeagueSummary };

export function LeagueSyncButton({ league }: LeagueSyncButtonProps) {
  return (
    <SyncYahooButton
      leagueId={league.id}
      syncedAt={league.syncedAt}
      syncError={league.syncError}
      syncVia={league.syncVia}
      externalUrl={league.externalUrl}
      autoSyncWhenStale
    />
  );
}

// The league's own page on Yahoo. The hidden note, read as part of the name,
// says the link leaves for a new tab.
type OpenInYahooLinkProps = { href: string };

export function OpenInYahooLink({ href }: OpenInYahooLinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={styles.external}>
      Open in Yahoo
      <span className={styles.srOnly}> (opens in new tab)</span>
    </a>
  );
}
