import { recordFromKeys } from "#core/util/record";

// Standard competition ranking (ties share the better rank) of `items` on
// every key independently: each item gets its rank per key. Keys flagged
// lower-is-better (points allowed, turnovers) rank ascending.
export const rankByKeys = <T, K extends string>({
  items,
  keys,
  idOf,
  valueOf,
  lowerIsBetter,
}: {
  items: readonly T[];
  keys: readonly K[];
  idOf: (item: T) => string;
  valueOf: (args: { item: T; key: K }) => number;
  lowerIsBetter: (key: K) => boolean;
}): Map<string, Record<K, number>> => {
  const rankFor = (key: K): Map<string, number> => {
    const ascending = lowerIsBetter(key);
    const value = (item: T): number => valueOf({ item, key });
    const sorted = [...items].sort((a, b) =>
      ascending ? value(a) - value(b) : value(b) - value(a),
    );
    return sorted.reduce<Map<string, number>>((acc, item, index) => {
      const previous = sorted[index - 1];
      const rank =
        previous !== undefined && value(previous) === value(item)
          ? (acc.get(idOf(previous)) ?? index + 1)
          : index + 1;
      return acc.set(idOf(item), rank);
    }, new Map());
  };
  const byKey = new Map(keys.map((key) => [key, rankFor(key)]));
  return new Map(
    items.map((item) => [
      idOf(item),
      recordFromKeys({ keys, value: (key) => byKey.get(key)?.get(idOf(item)) ?? 0 }),
    ]),
  );
};
