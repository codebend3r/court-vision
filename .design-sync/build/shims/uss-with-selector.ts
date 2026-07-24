// ESM stand-in for `use-sync-external-store/(shim/)with-selector`, aliased in
// the design-sync Vite build. Same reason as uss-shim.ts: the published package
// is CJS-only and `require("react")`s at runtime. This is the upstream
// useSyncExternalStoreWithSelector port, built on React's native
// useSyncExternalStore (used by zustand's selector hooks and nuqs).
import { useEffect, useMemo, useRef, useSyncExternalStore, useDebugValue } from "react";

type Inst<T> = { hasValue: boolean; value: T | null };

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  const instRef = useRef<Inst<Selection> | null>(null);
  let inst: Inst<Selection>;
  if (instRef.current === null) {
    inst = { hasValue: false, value: null };
    instRef.current = inst;
  } else {
    inst = instRef.current;
  }

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;
    const memoizedSelector = (nextSnapshot: Snapshot): Selection => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined && inst.hasValue) {
          const currentSelection = inst.value as Selection;
          if (isEqual(currentSelection, nextSelection)) {
            memoizedSelection = currentSelection;
            return currentSelection;
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }
      const prevSnapshot = memoizedSnapshot;
      const prevSelection = memoizedSelection;
      if (Object.is(prevSnapshot, nextSnapshot)) {
        return prevSelection;
      }
      const nextSelection = selector(nextSnapshot);
      if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return prevSelection;
      }
      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };
    const maybeGetServerSnapshot = getServerSnapshot === undefined || getServerSnapshot === null ? null : getServerSnapshot;
    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot());
    const getServerSnapshotWithSelector =
      maybeGetServerSnapshot === null ? undefined : () => memoizedSelector(maybeGetServerSnapshot());
    return [getSnapshotWithSelector, getServerSnapshotWithSelector] as const;
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection);
  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);
  useDebugValue(value);
  return value;
}
