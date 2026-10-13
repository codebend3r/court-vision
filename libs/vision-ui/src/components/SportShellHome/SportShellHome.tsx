import { type SportDescriptor, type SportKeys } from "@vision/core/sport/types";

import { ComingSoonPanel } from "#ui/components/ComingSoonPanel/ComingSoonPanel";
import { PageHeader } from "#ui/components/PageHeader/PageHeader";
import { SportOverview } from "#ui/components/SportOverview/SportOverview";

import styles from "#ui/components/SportShellHome/SportShellHome.module.scss";

// A shell app's copy, written once in the app and read by both its metadata
// and this page.
export type SportShellCopy = {
  // The app's name, e.g. "Rink Vision": the page title.
  name: string;
  // e.g. "Fantasy hockey".
  eyebrow: string;
  // The league whose stats will feed the app, e.g. "NHL".
  league: string;
  description: string;
};

export type SportShellHomeProps<K extends SportKeys> = SportShellCopy & {
  sport: SportDescriptor<K>;
};

// A shell app's one page until its league's data lands: what the fantasy game
// is made of, read from the sport descriptor the shared engine already runs on.
export const SportShellHome = <K extends SportKeys>({
  sport,
  name,
  eyebrow,
  league,
  description,
}: SportShellHomeProps<K>) => (
  <main className={styles.page}>
    <PageHeader eyebrow={eyebrow} title={name} description={description} />
    <ComingSoonPanel
      title="Player data"
      description={`${league} stats aren't connected yet. The valuation engine is ready; it needs a season of game logs to rank.`}
    />
    <SportOverview sport={sport} />
  </main>
);
