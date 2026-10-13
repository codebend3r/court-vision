import styles from "#ui/components/SkipLink/SkipLink.module.scss";

// The id of the wrapper every root layout puts around its routes: the skip
// link's target. It sits on the wrapper rather than each page's <main> so every
// route gets it from one place; give it tabIndex -1 so it takes focus without
// adding a tab stop.
export const MAIN_CONTENT_ID = "main-content";

// First tab stop on every route: without it keyboard and switch users cross
// every header and nav stop before reaching page content. Hidden until focused.
export function SkipLink() {
  return (
    <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
      Skip to main content
    </a>
  );
}
