// `map`, one item at a time. Some work must not overlap: measuring a route
// against a server is the case here, where concurrent requests contend for the
// same process and would time queueing rather than the route. Written once so
// the call sites read as intent rather than as a promise chain folded through
// a reduce.
type RunProps<Item> = { item: Item; index: number };

type SequentiallyProps<Result, Item> = {
  items: readonly Item[];
  run: (args: RunProps<Item>) => Promise<Result>;
};

export const sequentially = async <Item, Result>({
  items,
  run,
}: SequentiallyProps<Result, Item>): Promise<Result[]> =>
  items.reduce<Promise<Result[]>>(
    async (previous, item, index) => [...(await previous), await run({ item, index })],
    Promise.resolve([]),
  );
