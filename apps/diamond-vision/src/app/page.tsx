import { baseball } from "@vision/sport-baseball/descriptor";
import { ComingSoonPanel } from "@vision/ui/components/ComingSoonPanel/ComingSoonPanel";
import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { SportOverview } from "@vision/ui/components/SportOverview/SportOverview";

import styles from "@/app/page.module.scss";

// The shell's one page until MLB data lands: what the fantasy game is made
// of, read from the sport descriptor the shared engine already runs on.
export default function HomePage() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Fantasy baseball"
        title="Diamond Vision"
        description="Fantasy baseball analytics: hitter and pitcher value across 5×5 categories, points leagues, and positional scarcity."
      />
      <ComingSoonPanel
        title="Player data"
        description="MLB stats aren't connected yet. The valuation engine is ready; it needs a season of game logs to rank."
      />
      <SportOverview sport={baseball} />
    </main>
  );
}
