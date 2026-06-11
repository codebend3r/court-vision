import styles from "./Hello.module.scss";

export function Hello({ name }: { name: string }) {
  return (
    <section className={styles.hello}>
      <h1 className={styles.title}>Court Vision</h1>
      <p className={styles.subtitle}>Hello, {name}.</p>
    </section>
  );
}
