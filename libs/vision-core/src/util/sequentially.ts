// `map`, one item at a time. Some work must not overlap: measuring a route
// against a server is the case here, where concurrent requests contend for the
// same process and would time queueing rather than the route. Written once so
// the call sites read as intent rather than as a promise chain folded through
// a reduce.
export const sequentially = async <Item, Result>({
  items,
  run,
}: {
  items: readonly Item[];
  run: (args: { item: Item; index: number }) => Promise<Result>;
}): Promise<Result[]> =>
  items.reduce<Promise<Result[]>>(
    async (previous, item, index) => [...(await previous), await run({ item, index })],
    Promise.resolve([]),
  );
