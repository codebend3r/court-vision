import { useEffect, useEffectEvent, type RefObject } from "react";

// Closes a popover (a menu, a switcher, a dropdown) when a pointer goes down
// anywhere outside it. `ref` wraps everything that counts as inside: the
// trigger as well as the panel, so a click on the trigger toggles rather than
// closing and immediately reopening. Escape and focus handling stay with the
// widget, which knows where focus should land.
export const useDismiss = ({
  open,
  ref,
  onDismiss,
}: {
  open: boolean;
  ref: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}): void => {
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const container = ref.current;
      if (container === null) return;
      if (event.target instanceof Node && container.contains(event.target)) return;
      dismiss();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, ref]);
};
