import { type SportDescriptor, type SportKeys } from "#core/sport/types";
import { isKeyOf } from "#core/util/record";
import { methodNeedsCategories } from "#core/valuation/registry";

const duplicates = (values: readonly string[]): string[] =>
  values.filter((value, index) => values.indexOf(value) !== index);

// Every way a descriptor can be internally inconsistent that its types cannot
// catch: categories missing from the table order, stats nothing declares,
// groups with no replacement depth. Each sport lib asserts this returns [].
export const describeSportIssues = <K extends SportKeys>({
  sport,
}: {
  sport: SportDescriptor<K>;
}): string[] => {
  const declared = [...Object.keys(sport.counting), ...Object.keys(sport.ratio)];
  const ordered: readonly string[] = sport.categoryOrder;
  const valued: readonly string[] = sport.valuedStats;
  const groups: readonly string[] = sport.positions.groups;
  const isCounting = isKeyOf({ record: sport.counting });
  const isRatio = isKeyOf({ record: sport.ratio });
  const statsRead: readonly string[] = [
    ...Object.keys(sport.counting).flatMap((key) =>
      isCounting(key) ? [sport.counting[key].stat] : [],
    ),
    ...Object.keys(sport.ratio).flatMap((key) =>
      isRatio(key) ? [sport.ratio[key].numerator, sport.ratio[key].denominator] : [],
    ),
    ...sport.points.keys,
  ];
  return [
    ...duplicates(ordered).map((key) => `category "${key}" appears twice in categoryOrder`),
    ...declared
      .filter((key) => !ordered.includes(key))
      .map((key) => `category "${key}" is missing from categoryOrder`),
    ...ordered
      .filter((key) => !declared.includes(key))
      .map((key) => `categoryOrder names undeclared category "${key}"`),
    ...duplicates(valued).map((key) => `stat "${key}" appears twice in valuedStats`),
    ...statsRead
      .filter((key) => !valued.includes(key))
      .map((key) => `stat "${key}" is read but not in valuedStats`),
    ...sport.pools.flatMap((pool) =>
      pool.categories
        .filter((key) => !ordered.includes(key))
        .map((key) => `pool "${pool.key}" scores undeclared category "${key}"`),
    ),
    ...duplicates(sport.pools.map((pool) => pool.key)).map(
      (key) => `pool "${key}" is declared twice`,
    ),
    ...groups
      .filter((group) => !Object.hasOwn(sport.positions.replacementSlots, group))
      .map((group) => `group "${group}" has no replacement slots`),
    ...duplicates(sport.slots.map((slot) => slot.type)).map(
      (type) => `slot "${type}" is declared twice`,
    ),
    ...(sport.methods.length === 0 ? ["methods lists no method"] : []),
    ...(sport.replacementBase === "points" && sport.points.keys.length === 0
      ? ["replacementBase is points but the points table is empty"]
      : []),
    ...(sport.categoryOrder.length === 0
      ? sport.methods
          .filter((method) => methodNeedsCategories({ key: method }))
          .map((method) => `method "${method}" needs categories, and this sport has none`)
      : []),
    ...sport.slots.flatMap((slot) =>
      slot.defaultCount > slot.max
        ? [`slot "${slot.type}" defaults above its max (${slot.defaultCount} > ${slot.max})`]
        : [],
    ),
  ];
};
