// Measures a client-supplied snapshot without building it as JSON first.
//
// A server action's argument comes out of React's reply decoder, which shares
// an outlined chunk wherever the body references its id. A body of a few
// hundred bytes can therefore decode into an object reused at every level of a
// deep chain, and `JSON.stringify` on that would write 2^depth copies, using
// gigabytes before it fails. Counting inside the replacer stops the walk as
// soon as the running total passes the limit, so the cost is bounded by the
// limit, not by the size the payload pretends to have.

export type SnapshotSize = { status: "within" } | { status: "over" };

// Thrown out of the replacer to stop `JSON.stringify` early. Private, so
// nothing a payload contains can throw it.
const OVER_LIMIT = new Error("snapshot over the size limit");

const encoder = new TextEncoder();

type Utf8LengthProps = { text: string };

const utf8Length = ({ text }: Utf8LengthProps): number => encoder.encode(text).length;

/**
 * Walks the payload as `JSON.stringify` would, adding up the UTF-8 bytes of
 * every key and string value it visits. Anything JSON can't encode (a BigInt,
 * a cycle) is `over` as well.
 */
type MeasureSnapshotBytesProps = {
  payload: unknown;
  limit: number;
};

export const measureSnapshotBytes = ({
  payload,
  limit,
}: MeasureSnapshotBytesProps): SnapshotSize => {
  let total = 0;
  const replacer = (key: string, value: unknown): unknown => {
    total +=
      utf8Length({ text: key }) + (typeof value === "string" ? utf8Length({ text: value }) : 0);
    if (total > limit) throw OVER_LIMIT;
    return value;
  };
  try {
    JSON.stringify(payload, replacer);
    return { status: "within" };
  } catch {
    return { status: "over" };
  }
};
