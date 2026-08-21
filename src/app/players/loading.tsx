import { PageHeader } from "@/components/PageHeader/PageHeader";
import { Preloader } from "@/components/Preloader/Preloader";

import { PLAYERS_PAGE_HEADER } from "@/app/players/header";

import styles from "@/app/players/page.module.scss";

// Players is the slowest route (full-table stat sort on cold cache), so its
// skeleton renders the real PageHeader off the same constant page.tsx uses, for
// a jump-free swap when the table arrives. Next.js requires the default export
// for loading.tsx.
export default function Loading() {
  return (
    <main className={styles.page}>
      <PageHeader {...PLAYERS_PAGE_HEADER} />
      <Preloader label="Loading players" lines={9} />
    </main>
  );
}
