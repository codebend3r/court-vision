import specimen from "@/app/design/sections/specimen.module.scss";
import styles from "@/app/design/sections/Headings.module.scss";

const HEADING_TAGS = ["h2", "h3", "h4", "h5"] as const;

export function Headings() {
  return (
    <div className={styles.headingStack}>
      {/* The page keeps its title as its one h1, so the h1 specimen wears the
          page-title treatment on a paragraph. */}
      <div className={styles.headingRow}>
        <span className={specimen.specimenName}>h1 (page title)</span>
        <p className={styles.titleSample}>Fourth quarter comeback</p>
      </div>
      {HEADING_TAGS.map((HeadingTag) => (
        <div key={HeadingTag} className={styles.headingRow}>
          <span className={specimen.specimenName}>{HeadingTag}</span>
          <HeadingTag className={styles.headingSample}>Fourth quarter comeback</HeadingTag>
        </div>
      ))}
    </div>
  );
}
