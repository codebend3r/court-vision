// bun:test has no `vi.stubEnv`/`vi.unstubAllEnvs`, so environment overrides are
// snapshotted here and rolled back per test file. `bun test --isolate` gives each
// file a fresh module registry, so this record never leaks between suites.
const originals = new Map<string, string | undefined>();

export const stubEnv = ({ key, value }: { key: string; value: string }): void => {
  if (!originals.has(key)) {
    originals.set(key, process.env[key]);
  }
  process.env[key] = value;
};

export const restoreEnv = (): void => {
  originals.forEach((value, key) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = value;
  });
  originals.clear();
};
