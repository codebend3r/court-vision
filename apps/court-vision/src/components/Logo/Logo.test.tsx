import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { LogoLockup, LogoMark, LogoWordmark } from "@/components/Logo/Logo";

afterEach(cleanup);

const strokesOf = (container: HTMLElement): number[] => {
  const widths = [...container.querySelectorAll("[stroke-width]")].map((el) =>
    Number(el.getAttribute("stroke-width")),
  );
  return [...new Set(widths)];
};

describe("LogoMark", () => {
  it("draws the full plate with arcs at 32px and above, stroke 3", () => {
    const { container } = render(<LogoMark size={34} />);
    expect(container.querySelectorAll("path").length).toBe(2);
    expect(container.querySelector("circle")).not.toBeNull();
    expect(strokesOf(container)).toEqual([3]);
  });

  it("drops the arcs between 20 and 31px, stroke 4", () => {
    const { container } = render(<LogoMark size={24} />);
    expect(container.querySelectorAll("path").length).toBe(0);
    expect(container.querySelector("circle")).not.toBeNull();
    expect(strokesOf(container)).toEqual([4]);
  });

  it("keeps only the centre line below 20px, stroke 6", () => {
    const { container } = render(<LogoMark size={16} />);
    expect(container.querySelectorAll("path").length).toBe(0);
    expect(container.querySelector("circle")).toBeNull();
    expect(container.querySelector("line")).not.toBeNull();
    expect(strokesOf(container)).toEqual([6]);
  });

  it("is decorative: hidden from assistive tech", () => {
    const { container } = render(<LogoMark size={34} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LogoWordmark", () => {
  it("stacks Court over Vision", () => {
    const { container } = render(<LogoWordmark />);
    expect(container.textContent).toBe("CourtVision");
  });
});

describe("LogoLockup", () => {
  it("renders the 34px mark horizontally by default", () => {
    const { container } = render(<LogoLockup />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "34");
  });

  it("renders the 72px mark when vertical", () => {
    const { container } = render(<LogoLockup orientation="vertical" />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "72");
  });
});
