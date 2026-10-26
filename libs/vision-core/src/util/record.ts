// Records keyed by a string-literal union a sport supplies. TypeScript cannot
// build `Record<K, V>` from a generic key list on its own, so the one
// construction below is checked at runtime instead of cast.

// Any non-null object, so its properties can be read and checked one by one.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type HasEveryKeyProps<K extends string> = { keys: readonly K[] };

export const hasEveryKey =
  <K extends string>({ keys }: HasEveryKeyProps<K>) =>
  <V>(record: Record<string, V>): record is Record<K, V> =>
    keys.every((key) => Object.hasOwn(record, key));

type RecordFromKeysProps<V, K extends string> = {
  keys: readonly K[];
  value: (key: K) => V;
};

export const recordFromKeys = <K extends string, V>({
  keys,
  value,
}: RecordFromKeysProps<V, K>): Record<K, V> => {
  const record: Record<string, V> = Object.fromEntries(keys.map((key) => [key, value(key)]));
  if (!hasEveryKey({ keys })(record)) {
    throw new Error("recordFromKeys: a key went missing while building the record");
  }
  return record;
};

// A record keyed by each item's own `key` and valued from the item itself, so
// a list of specs keyed by a string-literal union becomes a record over it.
type RecordFromItemsProps<V, I extends { key: string }> = {
  items: readonly I[];
  value: (item: I) => V;
};

export const recordFromItems = <I extends { key: string }, V>({
  items,
  value,
}: RecordFromItemsProps<V, I>): Record<I["key"], V> => {
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
type IsKeyOfProps<T extends object> = { record: T };

export const isKeyOf =
  <T extends object>({ record }: IsKeyOfProps<T>) =>
  (key: PropertyKey): key is keyof T =>
    Object.hasOwn(record, key);
