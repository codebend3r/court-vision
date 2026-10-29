import { type AdvisorOwner } from "@/lib/advisor/types";

export type TeamOwner = Extract<AdvisorOwner, { kind: "team" }>;

/** Whether a player is on another team of the league, and so a trade target. */
export const isOnAnotherTeam = (owner: AdvisorOwner): owner is TeamOwner => owner.kind === "team";

/** Whether a player can be picked up: a free agent or on waivers. */
export const isFree = (
  owner: AdvisorOwner,
): owner is Extract<AdvisorOwner, { kind: "free_agent" | "waivers" }> =>
  owner.kind === "free_agent" || owner.kind === "waivers";
