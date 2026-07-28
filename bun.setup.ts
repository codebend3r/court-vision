import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { plugin } from "bun";
import { expect } from "bun:test";

import * as matchers from "@testing-library/jest-dom/matchers";

// bun:test ships no DOM, so component tests need one installed on the global
// object before @testing-library/react is imported by any test file. The
// preload runs first, so registering here is early enough. A concrete `url` is
// required: happy-dom otherwise starts at `about:blank`, against which the
// relative `src` next/image emits fails to parse.
GlobalRegistrator.register({ url: "http://localhost/" });

expect.extend(matchers);

// happy-dom ships a ResizeObserver but has no layout engine behind it, so every
// element measures 0x0 and recharts' ResponsiveContainer collapses to nothing.
// recharts skips measurement entirely when ResizeObserver is undefined and
// falls back to its `initialDimension` prop — the branch jsdom took, and the
// size the chart assertions are written against. Removing it restores that.
Reflect.deleteProperty(globalThis, "ResizeObserver");

// Bun's default loader resolves a `.scss` import to the file path string, which
// would make every `styles.foo` lookup undefined. Echoing the key back gives
// components real class names to render and keeps `toHaveClass` assertions
// meaningful. Symbols fall through so interop checks (`then`, `__esModule`,
// `Symbol.toPrimitive`) aren't answered with a bogus string.
const classNameProxy = new Proxy(
  {},
  {
    get: (_target, key) => (typeof key === "string" ? key : undefined),
  },
);

plugin({
  name: "scss-modules",
  setup(build) {
    build.onLoad({ filter: /\.scss$/ }, () => ({
      loader: "object",
      exports: { default: classNameProxy },
    }));
  },
});
