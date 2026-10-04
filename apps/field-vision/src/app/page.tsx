import { football } from "@vision/sport-football/descriptor";
import { ComingSoonPanel } from "@vision/ui/components/ComingSoonPanel/ComingSoonPanel";
import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { SportOverview } from "@vision/ui/components/SportOverview/SportOverview";

import styles from "@/app/page.module.scss";

// The shell's one page until NFL data lands: what the fantasy game is made
// of, read from the sport descriptor the shared engine already runs on.
export default function HomePage() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Fantasy football"
        title="Field Vision"
        description="Fantasy football analytics: PPR points and value over replacement at every position."
      />
      <ComingSoonPanel
        title="Player data"
        description="NFL stats aren't connected yet. The valuation engine is ready; it needs a season of game logs to rank."
      />
      <SportOverview sport={football} />
    </main>
  );
}
