import { Disclosure } from "@vision/ui/components/Disclosure/Disclosure";

import styles from "@/components/StatLegend/StatLegend.module.scss";

export type StatLegendEntry = {
  key: string;
  // The short name the table prints: a column header, say.
  term: string;
  // Bolded ahead of the description as "Full Name.".
  fullName?: string;
  description: string;
  // The plain-language "so what", under its own label.
  whyItMatters?: string;
  formula?: string;
};

export type StatLegendProps = {
  summary: string;
  entries: readonly StatLegendEntry[];
  // Lays the entries out in as many columns as fit, for a long glossary.
  columns?: boolean;
};

// The collapsed glossary card under a stats table: one row per term with its
// full name and description, plus why it matters and its formula when it has
// them. The Advanced and Fantasy tabs both explain their columns through it.
export function StatLegend({ summary, entries, columns = false }: StatLegendProps) {
  return (
    <Disclosure className={styles.legend} summaryClassName={styles.summary} summary={summary}>
      <dl className={styles.grid} data-columns={columns || undefined}>
        {entries.map((entry) => (
          <div key={entry.key} className={styles.row}>
            <dt className={styles.term}>{entry.term}</dt>
            <dd className={styles.desc}>
              <span>
                {!!entry.fullName && (
                  <>
                    <strong>{entry.fullName}.</strong>{" "}
                  </>
                )}
                {entry.description}
              </span>
              {!!entry.whyItMatters && (
                <span className={styles.why}>
                  <strong className={styles.whyLabel}>Why it matters:</strong> {entry.whyItMatters}
                </span>
              )}
              {!!entry.formula && <code className={styles.formula}>{entry.formula}</code>}
            </dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}
