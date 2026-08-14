import { PageHeader } from "@/components/PageHeader/PageHeader";
import { Preloader } from "@/components/Preloader/Preloader";

import styles from "@/app/players/page.module.scss";

// Players is the slowest route (full-table stat sort on cold cache), so its
// skeleton renders the real PageHeader (same props as page.tsx) for a
// jump-free swap when the table arrives. Next.js requires the default export
// for loading.tsx.
export default function Loading() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Research"
        title="Players"
        description="Every player, every metric. Sort on the number your league scores, not the one the box score prints."
      />
      <Preloader label="Loading players" lines={9} />
    </main>
  );
}
