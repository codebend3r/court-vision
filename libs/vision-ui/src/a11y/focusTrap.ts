import { useEffect, useRef, type RefObject } from "react";

// Everything that takes focus by default, minus anything explicitly removed
// from the tab order. Queried fresh on each Tab so a dialog whose contents
// change while open still wraps at its real edges.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export const focusableWithin = ({ container }: { container: HTMLElement }): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

// Modal behaviour a `role="dialog"` claims but does not get for free: move
// focus in on open, keep Tab inside while open, close on Escape, and put focus
// back where it came from on close.
export const useFocusTrap = ({
  containerRef,
  active,
  onEscape,
}: {
  containerRef: RefObject<HTMLElement | null>;
  active: boolean;
  onEscape: () => void;
}): void => {
  // Held in a ref so an inline arrow from the caller does not re-run the effect
  // on every render, which would yank focus back to the first item each time.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!active || container === null) return;

    const previouslyFocused = document.activeElement;
    focusableWithin({ container })[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableWithin({ container });
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      const edge = event.shiftKey ? first : last;
      if (document.activeElement !== edge) return;
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [active, containerRef]);
};
