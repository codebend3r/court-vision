import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { Preloader } from "@vision/ui/components/Preloader/Preloader";

import { ADVISOR_PAGE_HEADER } from "@/app/advisor/header";

import styles from "@/app/advisor/advisor.module.scss";

// The skeleton renders the real PageHeader off the same constant page.tsx
// uses, so the heading doesn't jump when the pool arrives. Next.js requires
// the default export for loading.tsx.
export default function Loading() {
  return (
    <main className={styles.page}>
      <PageHeader {...ADVISOR_PAGE_HEADER} />
      <Preloader label="Loading the Roster Advisor" lines={9} />
    </main>
  );
}
