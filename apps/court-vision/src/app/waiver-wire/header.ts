import type { PageHeaderProps } from "@vision/ui/components/PageHeader/PageHeader";

// The /waiver-wire heading, shared by the page (every gate and the ready view)
// and its loading skeleton so the swap stays jump-free. The ready view swaps
// the eyebrow for the league's name; the title and description never change.
export const WAIVER_WIRE_PAGE_HEADER = {
  eyebrow: "My league",
  title: "Waiver Wire",
  description: "How your league's free agents stack up against your team.",
} satisfies PageHeaderProps;
