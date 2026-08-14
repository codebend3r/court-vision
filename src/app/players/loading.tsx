import { Preloader } from "@/components/Preloader/Preloader";

import styles from "@/app/players/page.module.scss";

// Players is the slowest route (full-table stat sort on cold cache), so its
// skeleton keeps the real heading and page box for a stable-feeling swap.
// Next.js requires the default export for loading.tsx.
export default function Loading() {
  return (
    <main className={styles.page}>
      <h1>Players</h1>
      <Preloader label="Loading players" lines={9} />
    </main>
  );
}
