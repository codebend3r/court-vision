import styles from "@/components/WaiverWireView/WaiverWireView.module.scss";

// How many rows a windowed Waiver Wire list shows at first, and adds per
// "Show more".
export const ROWS_SHOWN = 25;

// Grows a windowed list by another page. The caller keeps it mounted while
// rows remain, so focus never drops.
type ShowMoreButtonProps = { remaining: number; onMore: () => void };

export function ShowMoreButton({ remaining, onMore }: ShowMoreButtonProps) {
  return (
    <button type="button" className={styles.keycap} onClick={onMore}>
      Show {Math.min(ROWS_SHOWN, remaining)} more ({remaining} left)
    </button>
  );
}
