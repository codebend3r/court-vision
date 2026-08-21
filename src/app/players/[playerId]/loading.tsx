import { Preloader } from "@/components/Preloader/Preloader";

import styles from "@/app/players/[playerId]/page.module.scss";

// Next.js requires the default export for loading.tsx.
export default function Loading() {
  return (
    <main className={styles.page}>
      <Preloader label="Loading player" lines={6} />
    </main>
  );
}
