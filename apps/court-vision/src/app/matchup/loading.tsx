import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { Preloader } from "@vision/ui/components/Preloader/Preloader";

import { MATCHUP_PAGE_HEADER } from "@/app/matchup/header";

import styles from "@/app/matchup/matchup.module.scss";

// The skeleton renders the real PageHeader off the same constant page.tsx uses,
// so the heading doesn't jump when the week arrives. Next.js requires the
// default export for loading.tsx.
export default function Loading() {
  return (
    <main className={styles.page}>
      <PageHeader {...MATCHUP_PAGE_HEADER} />
      <Preloader label="Loading the matchup" lines={9} />
    </main>
  );
}
