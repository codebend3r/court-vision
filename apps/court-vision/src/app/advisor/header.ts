import type { PageHeaderProps } from "@vision/ui/components/PageHeader/PageHeader";

// The /advisor heading, shared by the page (every gate and the ready view) and
// its loading skeleton so the swap stays jump-free. The ready view swaps the
// eyebrow for the league's name.
export const ADVISOR_PAGE_HEADER = {
  eyebrow: "My league",
  title: "Roster Advisor",
  description:
    "Your team's biggest weakness, the player who fixes it, and how to get them: a trade, a pickup, and who to drop.",
} satisfies PageHeaderProps;
