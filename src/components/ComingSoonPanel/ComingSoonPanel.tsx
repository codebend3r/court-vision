import styles from "@/components/ComingSoonPanel/ComingSoonPanel.module.scss";

export type ComingSoonPanelProps = {
  title: string;
  description: string;
};

export function ComingSoonPanel({ title, description }: ComingSoonPanelProps) {
  return (
    <section className={styles.panel} aria-label={title}>
      <span className={styles.badge}>Coming soon</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </section>
  );
}
