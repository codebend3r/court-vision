import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";
import { Preloader } from "@vision/ui/components/Preloader/Preloader";

import { WAIVER_WIRE_PAGE_HEADER } from "@/app/waiver-wire/header";

import styles from "@/app/waiver-wire/waiverWire.module.scss";

// The skeleton renders the real PageHeader off the same constant page.tsx
// uses, so the heading doesn't jump when the pool arrives. Next.js requires
// the default export for loading.tsx.
export default function Loading() {
  return (
    <main className={styles.page}>
      <PageHeader {...WAIVER_WIRE_PAGE_HEADER} />
      <Preloader label="Loading the Waiver Wire" lines={9} />
    </main>
  );
}
