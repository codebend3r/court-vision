import { type AdvisorPlayer, type FreeAgentPick } from "@/lib/advisor/types";

const MAX_FREE_AGENTS = 5;
const MIN_FREE_AGENTS = 2;

/**
 * Who to drop for a pickup: my healthy player with the lowest value once their
 * weak-category contribution is added back, so the player propping up the
 * category being fixed is the last to go. Ties by player id. Null with nobody.
 */
type PickDropProps = { myRoster: readonly AdvisorPlayer[] };

export const pickDrop = ({ myRoster }: PickDropProps): AdvisorPlayer | null =>
  myRoster.toSorted(
    (a, b) =>
      a.value + Math.max(0, a.categoryScore) - (b.value + Math.max(0, b.categoryScore)) ||
      a.playerId - b.playerId,
  )[0] ?? null;

/**
 * Up to five free agents for the weak category, best in it first, keeping
 * those worth more overall than the drop candidate. When fewer than two
 * qualify, the next best in the category fill to two, marked as no upgrade.
 */
type PickFreeAgentsProps = {
  freePool: readonly AdvisorPlayer[];
  drop: AdvisorPlayer | null;
};

export const pickFreeAgents = ({ freePool, drop }: PickFreeAgentsProps): FreeAgentPick[] => {
  const toPick = (player: AdvisorPlayer): FreeAgentPick => ({
    ...player,
    gainOverDrop: drop === null ? null : player.value - drop.value,
    isUpgrade: drop === null || player.value > drop.value,
  });
  const ranked = freePool
    .toSorted(
      (a, b) => b.categoryScore - a.categoryScore || b.value - a.value || a.playerId - b.playerId,
    )
    .map(toPick);
  const upgrades = ranked.filter((pick) => pick.isUpgrade).slice(0, MAX_FREE_AGENTS);
  const fillers = ranked
    .filter((pick) => !pick.isUpgrade)
    .slice(0, Math.max(0, MIN_FREE_AGENTS - upgrades.length));
  return [...upgrades, ...fillers];
};
