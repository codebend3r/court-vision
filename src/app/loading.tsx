import { Preloader } from "@/components/Preloader/Preloader";

import styles from "@/app/page.module.scss";

// Root loading boundary: any route without its own loading.tsx bubbles up to
// this one, so every navigation paints a preloader immediately. The box comes
// from the root page's own module (page-shell), so the skeleton and the page
// that replaces it cannot drift apart. Next.js requires the default export
// here (named exports break the file convention).
export default function Loading() {
  return (
    <main className={styles.page}>
      <Preloader />
    </main>
  );
}
