import styles from "@/components/ComingSoonPanel/ComingSoonPanel.module.scss";

export type ComingSoonPanelProps = {
  title: string;
  description: string;
};

export function ComingSoonPanel({ title, description }: ComingSoonPanelProps) {
  const titleId = `coming-soon-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <span className={styles.badge}>Coming soon</span>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <p className={styles.description}>{description}</p>
    </section>
  );
}
