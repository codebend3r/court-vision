import { useEffect, useRef } from "react";

import { MAX_QUERY_LENGTH } from "@/lib/players/searchParams";

const DEBOUNCE_MS = 300;

// The one part of an input's change event the hook reads.
type SearchChange = { target: { value: string } };

// A player search box's typing, settled: the trimmed, capped text commits
// 300ms after the last keystroke, and only when it differs from the query
// already applied. `cancel` drops a pending commit, for a control that
// navigates on its own before the timer fires.
type OnCommitProps = { q: string };

type UseDebouncedQueryProps = {
  q: string;
  onCommit: (args: OnCommitProps) => void;
};

export const useDebouncedQuery = ({
  q,
  onCommit,
}: UseDebouncedQueryProps): {
  onChange: (event: SearchChange) => void;
  cancel: () => void;
} => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read when the timer fires, not when it was set, so a query that catches up
  // while the timer is pending (a navigation landing) skips the commit.
  const latestQ = useRef(q);

  useEffect(() => {
    latestQ.current = q;
  }, [q]);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const cancel = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onChange = (event: SearchChange) => {
    const { value } = event.target;
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      const trimmed = value.trim().slice(0, MAX_QUERY_LENGTH);
      if (trimmed === latestQ.current) return;
      onCommit({ q: trimmed });
    }, DEBOUNCE_MS);
  };

  return { onChange, cancel };
};
