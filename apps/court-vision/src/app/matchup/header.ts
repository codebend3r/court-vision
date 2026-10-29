import type { PageHeaderProps } from "@vision/ui/components/PageHeader/PageHeader";

// The /matchup heading, shared by the page (every gate and the ready view) and
// its loading skeleton so the swap stays jump-free. The ready view swaps the
// eyebrow for the league's name and the week.
export const MATCHUP_PAGE_HEADER = {
  eyebrow: "My league",
  title: "Matchup",
  description:
    "Each week's head-to-head, where your totals stand against the whole league, and how the season has gone.",
} satisfies PageHeaderProps;
