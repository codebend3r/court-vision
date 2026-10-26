import { describe, expect, it } from "bun:test";

import { inlineParameterTypes } from "#scripts/parameter-types";

describe("inlineParameterTypes", () => {
  it("finds inline parameters in functions, callbacks and type signatures", () => {
    const source = `
      function save({ id }: { id: string }) {}
      const run = ({ tx }: Pick<Client, 'tx'> & { tx: string }) => tx;
      type Handler = (event: { name: string }) => void;
    `;
    expect(inlineParameterTypes({ source })).toEqual([2, 3, 4]);
  });

  it("allows named aliases, generic selectors and literal return types", () => {
    const source = `
      type SaveProps = { id: string };
      type Result = Extract<Union, { kind: 'ok' }>;
      function save({ id }: SaveProps): { id: string } { return { id }; }
    `;
    expect(inlineParameterTypes({ source })).toEqual([]);
  });

  it("counts nested callback annotations only once", () => {
    expect(
      inlineParameterTypes({
        source: "function f({ run }: { run: (args: { id: number }) => void }) {}",
      }),
    ).toEqual([1, 1]);
  });

  it("checks nested parameter types and defaulted bindings", () => {
    expect(
      inlineParameterTypes({ source: "const f = ({ id }: { id: number } = { id: 1 }) => id;" }),
    ).toEqual([1]);
    expect(
      inlineParameterTypes({ source: "type Props = { run: (args: { id: number }) => void };" }),
    ).toEqual([1]);
  });
});
