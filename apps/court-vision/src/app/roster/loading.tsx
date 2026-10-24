import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { Preloader } from "@vision/ui/components/Preloader/Preloader";

import { ROSTER_PAGE_HEADER } from "@/app/roster/header";

import styles from "@/app/roster/page.module.scss";

// The skeleton renders the real PageHeader off the same constant page.tsx
// uses, so the heading doesn't jump when the roster arrives. Next.js requires
// the default export for loading.tsx.
export default function Loading() {
  return (
    <main className={styles.page}>
      <PageHeader {...ROSTER_PAGE_HEADER} />
      <Preloader label="Loading your roster" lines={8} />
    </main>
  );
}
