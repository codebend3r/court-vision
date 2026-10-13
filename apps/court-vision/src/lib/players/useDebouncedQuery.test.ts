import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { useDebouncedQuery } from "@/lib/players/useDebouncedQuery";

const onCommit = vi.fn<(args: { q: string }) => void>();

// The part of an input's change event the hook reads.
const typed = (value: string) => ({ target: { value } });

beforeEach(() => {
  onCommit.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("useDebouncedQuery", () => {
  it("commits the trimmed text once, 300ms after the last keystroke", () => {
    const { result } = renderHook(() => useDebouncedQuery({ q: "", onCommit }));

    result.current.onChange(typed("c"));
    result.current.onChange(typed("  cur  "));
    advance(299);
    expect(onCommit).not.toHaveBeenCalled();

    advance(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ q: "cur" });
  });

  it("caps the committed text at the query length limit", () => {
    const { result } = renderHook(() => useDebouncedQuery({ q: "", onCommit }));

    result.current.onChange(typed("x".repeat(150)));
    advance(300);

    expect(onCommit).toHaveBeenCalledWith({ q: "x".repeat(100) });
  });

  it("skips the commit when the query has caught up while the timer was pending", () => {
    const { result, rerender } = renderHook(({ q }) => useDebouncedQuery({ q, onCommit }), {
      initialProps: { q: "" },
    });

    result.current.onChange(typed("cur"));
    rerender({ q: "cur" });
    advance(300);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("drops a pending commit on cancel and on unmount", () => {
    const { result, unmount } = renderHook(() => useDebouncedQuery({ q: "", onCommit }));

    result.current.onChange(typed("cur"));
    result.current.cancel();
    advance(300);
    result.current.onChange(typed("curry"));
    unmount();
    advance(300);

    expect(onCommit).not.toHaveBeenCalled();
  });
});
