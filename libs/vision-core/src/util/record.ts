// Records keyed by a string-literal union a sport supplies. TypeScript cannot
// build `Record<K, V>` from a generic key list on its own, so the one
// construction below is checked at runtime instead of cast.

// Any non-null object, so its properties can be read and checked one by one.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const hasEveryKey =
  <K extends string>({ keys }: { keys: readonly K[] }) =>
  <V>(record: Record<string, V>): record is Record<K, V> =>
    keys.every((key) => Object.hasOwn(record, key));

export const recordFromKeys = <K extends string, V>({
  keys,
  value,
}: {
  keys: readonly K[];
  value: (key: K) => V;
}): Record<K, V> => {
  const record: Record<string, V> = Object.fromEntries(keys.map((key) => [key, value(key)]));
  if (!hasEveryKey({ keys })(record)) {
    throw new Error("recordFromKeys: a key went missing while building the record");
  }
  return record;
};

// A record keyed by each item's own `key` and valued from the item itself, so
// a list of specs keyed by a string-literal union becomes a record over it.
export const recordFromItems = <I extends { key: string }, V>({
  items,
  value,
}: {
  items: readonly I[];
  value: (item: I) => V;
}): Record<I["key"], V> => {
  const record: Record<string, V> = Object.fromEntries(
    items.map((item) => [item.key, value(item)]),
  );
  if (!hasEveryKey({ keys: items.map((item) => item.key) })(record)) {
    throw new Error("recordFromItems: a key went missing while building the record");
  }
  return record;
};

// Type guards need the narrowed value as their own parameter, so this one is
// curried: `isKeyOf({ record })(key)`.
export const isKeyOf =
  <T extends object>({ record }: { record: T }) =>
  (key: PropertyKey): key is keyof T =>
    Object.hasOwn(record, key);
