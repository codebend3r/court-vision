import styles from "@/components/Preloader/Preloader.module.scss";

export type PreloaderProps = {
  label?: string;
  lines?: number;
};

// Route-level loading fallback. `role="status"` makes the wait audible to
// screen readers (polite, implicit); the shimmer blocks are decorative and
// hidden, only animating when the user allows motion (see the module).
export function Preloader({ label = "Loading page", lines = 4 }: PreloaderProps) {
  return (
    <div className={styles.preloader} role="status">
      <span className={styles.hiddenLabel}>{label}</span>
      <span className={styles.blocks} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className={styles.block} />
        ))}
      </span>
    </div>
  );
}
