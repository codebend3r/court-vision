import { type AdvisorOwner } from "@/lib/advisor/types";

const ONE_PLACE = 1;

/** Where a player is, in a word or two. */
type OwnerTextProps = { owner: AdvisorOwner };

export const ownerText = ({ owner }: OwnerTextProps): string => {
  if (owner.kind === "team") return owner.teamName;
  if (owner.kind === "waivers") return "On waivers";
  if (owner.kind === "free_agent") return "Free agent";
  return "Your team";
};

/** A trade's value balance in words: "5.1 value in your favor", "Even on value". */
type BalanceTextProps = { balance: number };

export const balanceText = ({ balance }: BalanceTextProps): string => {
  const size = Math.abs(balance).toFixed(ONE_PLACE);
  if (size === (0).toFixed(ONE_PLACE)) return "Even on value";
  return balance < 0 ? `${size} value in your favor` : `${size} value in their favor`;
};
