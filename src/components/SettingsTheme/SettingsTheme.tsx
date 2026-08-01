import styles from "@/components/SettingsTheme/SettingsTheme.module.scss";

// Placeholder section: theme is currently a light/dark toggle wired up
// elsewhere (see lib/theme/ThemeProvider); a settings-page theme control
// lands in a later task.
export function SettingsTheme() {
  return (
    <section className={styles.section} aria-labelledby="settings-theme-heading">
      <h2 id="settings-theme-heading" className={styles.heading}>
        Theme
      </h2>
      <p className={styles.placeholder}>Something soon.</p>
    </section>
  );
}
