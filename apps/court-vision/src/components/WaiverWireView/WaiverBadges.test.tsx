import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { WaiverBadges } from "@/components/WaiverWireView/WaiverBadges";

afterEach(cleanup);

describe("WaiverBadges", () => {
  it("shows the injury code and reads its full name", () => {
    render(<WaiverBadges injuryStatus="Q" owner="mine" />);

    expect(screen.getByText("Q")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Questionable")).toHaveClass("srOnly");
  });

  it("reads every known injury code by name", () => {
    const names: [string, string][] = [
      ["O", "Out"],
      ["P", "Probable"],
      ["D", "Doubtful"],
      ["INJ", "Injured"],
      ["NA", "Not active"],
    ];
    names.map(([code, name]) => {
      render(<WaiverBadges injuryStatus={code} owner="free_agent" />);
      expect(screen.getByText(code)).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByText(name)).toHaveClass("srOnly");
      cleanup();
    });
  });

  it("reads an unknown code as itself", () => {
    render(<WaiverBadges injuryStatus="GTD" owner="free_agent" />);

    expect(screen.getByText("GTD", { selector: "[aria-hidden='true']" })).toBeInTheDocument();
    expect(screen.getByText("GTD", { selector: ".srOnly" })).toBeInTheDocument();
  });

  it("tags a player on waivers with W, read as On waivers", () => {
    render(<WaiverBadges injuryStatus={null} owner="waivers" />);

    expect(screen.getByText("W")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("On waivers")).toHaveClass("srOnly");
  });

  it("renders nothing for a healthy free agent", () => {
    const { container } = render(<WaiverBadges injuryStatus={null} owner="free_agent" />);

    expect(container).toBeEmptyDOMElement();
  });
});
