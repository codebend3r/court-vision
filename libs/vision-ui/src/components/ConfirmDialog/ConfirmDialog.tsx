"use client";

import { useId, useRef, type ReactNode } from "react";

import { useFocusTrap } from "#ui/a11y/focusTrap";

import styles from "#ui/components/ConfirmDialog/ConfirmDialog.module.scss";

export type ConfirmDialogProps = {
  // The question, as the dialog's heading and accessible name.
  title: ReactNode;
  // What confirming does, as the dialog's description.
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  // A destructive confirm (remove, delete) takes the danger keycap.
  destructive?: boolean;
  onConfirm: () => void;
  // Cancel, Escape, and a click on the backdrop all land here.
  onCancel: () => void;
};

// A modal yes/no question. Open while mounted: render it when there is
// something to confirm. Focus moves in (onto Cancel, the safe answer), Tab
// stays inside, Escape cancels, and focus returns to whatever opened it.
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useFocusTrap({ containerRef: dialogRef, active: true, onEscape: onCancel });

  return (
    <div className={styles.overlay} role="presentation" onClick={onCancel}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={bodyId} className={styles.body}>
          {children}
        </p>
        <span className={styles.actions}>
          <button type="button" onClick={onCancel} className={styles.cancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={styles.confirm}
            data-destructive={destructive || undefined}
          >
            {confirmLabel}
          </button>
        </span>
      </section>
    </div>
  );
}
